import { eq } from "drizzle-orm"

import { assessmentInstances, auditEvents, sessionNotes } from "@/db/schema"
import { db } from "@/lib/db"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

type DbClient = typeof db
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Forks a new draft version from a finalised session note.
 *
 * Copies the editable content across as a starting point (session date/
 * time, appointment link, battery instance link, practitioner notes) but
 * intentionally does NOT copy status/finalisedAt/pdfStoragePath — the new
 * row starts life as a fresh draft.
 *
 * Repoints any MSE/ASQ (assessment_instances) linked to the previous
 * version onto the new one, in the same transaction as the fork itself.
 * This happens at fork time, not finalise time: isCurrentVersion already
 * moves to the new draft the moment it's created, so "current" has
 * already shifted before finalise — delaying the repoint would just
 * leave the draft's MSE/ASQ view empty while it's being edited, with no
 * real safety benefit.
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

    await repointAssessmentInstancesToNewVersion({
      previousVersionId,
      newSessionNoteId: inserted.sessionNoteId,
      client: tx,
    })

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
 * against the previous version onto the new version. Called from inside
 * createSessionNoteVersion's own transaction (pass `client: tx`); the
 * plain `db` default is only for any one-off/manual use outside that
 * flow.
 */
export async function repointAssessmentInstancesToNewVersion({
  previousVersionId,
  newSessionNoteId,
  client = db,
}: {
  previousVersionId: string
  newSessionNoteId: string
  client?: DbClient | DbTransaction
}): Promise<void> {
  await client
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
