import { eq } from "drizzle-orm"

import { assessmentInstances, auditEvents, sessionNotes } from "@/db/schema"
import { db } from "@/lib/db"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

/**
 * Forks a new draft version from a finalised session note.
 *
 * Copies the editable content across as a starting point (session date/
 * time, appointment link, battery instance link, practitioner notes) but
 * intentionally does NOT copy status/finalisedAt/pdfStoragePath — the new
 * row starts life as a fresh draft.
 *
 * Does NOT repoint assessment_instances (MSE/ASQ) here — that only
 * happens when the new version is finalised (see finaliseNewSessionNoteVersion
 * in Phase 2's actions.ts wiring), so an abandoned draft never orphans
 * clinical data away from the still-current finalised version.
 */
export async function createSessionNoteVersion({
  previousVersionId,
  practiceId,
  userId,
}: {
  previousVersionId: string
  practiceId: string
  userId: string
}): Promise<{ sessionNoteId: string }> {
  const previous = await loadSessionNoteForPractice(previousVersionId, practiceId)
  if (!previous) {
    throw new Error("Session note not found.")
  }
  if (previous.status !== "finalised") {
    throw new Error("Only a finalised session note can be versioned.")
  }

  const nextVersion = (await getVersionNumber(previousVersionId)) + 1

  let newSessionNoteId!: string

  await db.transaction(async (tx) => {
    await tx
      .update(sessionNotes)
      .set({ isCurrentVersion: false, updatedAt: new Date() })
      .where(eq(sessionNotes.sessionNoteId, previousVersionId))

    const [inserted] = await tx
      .insert(sessionNotes)
      .values({
        clientId: previous.clientId,
        practiceId,
        practitionerProfileId: previous.practitionerProfileId,
        appointmentId: previous.appointmentId,
        batteryInstanceId: previous.batteryInstanceId,
        sessionDate: previous.sessionDate,
        sessionTime: previous.sessionTime,
        practitionerNotes: previous.practitionerNotes,
        status: "draft",
        versionNumber: nextVersion,
        isCurrentVersion: true,
        previousVersionId,
      })
      .returning({ sessionNoteId: sessionNotes.sessionNoteId })

    newSessionNoteId = inserted.sessionNoteId

    await tx.insert(auditEvents).values({
      practiceId,
      userId,
      clientId: previous.clientId,
      eventType: "session_note.version_created",
      entityType: "session_note",
      entityId: inserted.sessionNoteId,
    })
  })

  return { sessionNoteId: newSessionNoteId }
}

/**
 * Repoints any MSE/ASQ assessment_instances rows that were recorded
 * against the previous version onto the new (now-finalised) version.
 * Call this at the moment a forked draft version is finalised, not when
 * it's created — see the module doc comment above for why.
 */
export async function repointAssessmentInstancesToNewVersion({
  previousVersionId,
  newSessionNoteId,
}: {
  previousVersionId: string
  newSessionNoteId: string
}): Promise<void> {
  await db
    .update(assessmentInstances)
    .set({ sessionNoteId: newSessionNoteId, updatedAt: new Date() })
    .where(eq(assessmentInstances.sessionNoteId, previousVersionId))
}

async function getVersionNumber(sessionNoteId: string): Promise<number> {
  const [row] = await db
    .select({ versionNumber: sessionNotes.versionNumber })
    .from(sessionNotes)
    .where(eq(sessionNotes.sessionNoteId, sessionNoteId))
    .limit(1)

  return row?.versionNumber ?? 1
}
