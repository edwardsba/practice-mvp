import { and, asc, desc, eq, gt, or, sql } from "drizzle-orm"

import { appointments, batteryInstances, clients, sessionNotes } from "@/db/schema"
import type { SessionNoteFilter } from "@/lib/session-notes/constants"
import { db } from "@/lib/db"

export async function loadSessionNotesForPractice(
  practiceId: string,
  filter: SessionNoteFilter = "all",
  clientId?: string
) {
  const conditions = [eq(sessionNotes.practiceId, practiceId)]

  if (filter === "draft") {
    conditions.push(eq(sessionNotes.status, "draft"))
  } else if (filter === "finalised") {
    conditions.push(eq(sessionNotes.status, "finalised"))
  }

  if (clientId) {
    conditions.push(eq(sessionNotes.clientId, clientId))
  }

  return db
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      clientId: sessionNotes.clientId,
      sessionDate: sessionNotes.sessionDate,
      sessionTime: sessionNotes.sessionTime,
      status: sessionNotes.status,
      pdfStoragePath: sessionNotes.pdfStoragePath,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      preSessionBatterySentAt: appointments.preSessionBatterySentAt,
      batteryStatus: batteryInstances.status,
      asqCompleted: sql<boolean>`EXISTS (
        SELECT 1
        FROM assessment_instances ai
        JOIN assessment_definitions ad
          ON ai.assessment_definition_id = ad.assessment_definition_id
        JOIN assessment_results ar
          ON ar.assessment_instance_id = ai.assessment_instance_id
        WHERE ai.session_note_id = ${sessionNotes.sessionNoteId}
        AND ad.assessment_code = 'ASQ'
      )`.as("asq_completed"),
    })
    .from(sessionNotes)
    .innerJoin(clients, eq(sessionNotes.clientId, clients.clientId))
    .leftJoin(appointments, eq(sessionNotes.appointmentId, appointments.appointmentId))
    .leftJoin(
      batteryInstances,
      eq(sessionNotes.batteryInstanceId, batteryInstances.batteryInstanceId)
    )
    .where(and(...conditions))
    .orderBy(desc(sessionNotes.sessionDate), desc(sessionNotes.sessionTime))
}

export async function loadSessionNoteForPractice(
  sessionNoteId: string,
  practiceId: string
) {
  const [row] = await db
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      clientId: sessionNotes.clientId,
      practiceId: sessionNotes.practiceId,
      practitionerProfileId: sessionNotes.practitionerProfileId,
      appointmentId: sessionNotes.appointmentId,
      batteryInstanceId: sessionNotes.batteryInstanceId,
      sessionDate: sessionNotes.sessionDate,
      sessionTime: sessionNotes.sessionTime,
      practitionerNotes: sessionNotes.practitionerNotes,
      status: sessionNotes.status,
      finalisedAt: sessionNotes.finalisedAt,
      pdfStoragePath: sessionNotes.pdfStoragePath,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientDateOfBirth: clients.dateOfBirth,
    })
    .from(sessionNotes)
    .innerJoin(clients, eq(sessionNotes.clientId, clients.clientId))
    .where(
      and(
        eq(sessionNotes.sessionNoteId, sessionNoteId),
        eq(sessionNotes.practiceId, practiceId)
      )
    )
    .limit(1)

  return row ?? null
}

export async function loadSessionNoteForAppointment(
  appointmentId: string,
  practiceId: string
) {
  const [row] = await db
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      status: sessionNotes.status,
    })
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.appointmentId, appointmentId),
        eq(sessionNotes.practiceId, practiceId)
      )
    )
    .limit(1)

  return row ?? null
}

export async function loadLatestSessionNoteForClient(
  clientId: string,
  practiceId: string
) {
  const [row] = await db
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      sessionDate: sessionNotes.sessionDate,
      status: sessionNotes.status,
    })
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.clientId, clientId),
        eq(sessionNotes.practiceId, practiceId)
      )
    )
    .orderBy(desc(sessionNotes.sessionDate), desc(sessionNotes.sessionTime))
    .limit(1)

  return row ?? null
}

export async function loadNextAppointmentAfterSession(
  clientId: string,
  practiceId: string,
  sessionDate: string,
  sessionTime: string | null
) {
  const timeValue = sessionTime ?? "00:00:00"

  const [row] = await db
    .select({
      appointmentId: appointments.appointmentId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      location: appointments.location,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.practiceId, practiceId),
        or(
          gt(appointments.appointmentDate, sessionDate),
          and(
            eq(appointments.appointmentDate, sessionDate),
            gt(appointments.appointmentTime, timeValue)
          )
        )
      )
    )
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
    .limit(1)

  return row ?? null
}
