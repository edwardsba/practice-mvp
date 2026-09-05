import { and, eq } from "drizzle-orm"

import {
  appointments,
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
} from "@/db/schema"
import { parsePsfSeverity } from "@/lib/assessments/psf"
import { db } from "@/lib/db"
import { formatDateForInput } from "@/lib/dates/practice-time"

export type PsfFeedbackSession = {
  assessmentResultId: string
  /** ISO date string (yyyy-mm-dd), matching the appointment/assessment date fields. */
  date: string
  positiveFeedback: number
  negativeFeedback: number
}

export type CompletedAppointment = {
  appointmentId: string
  /** ISO date string (yyyy-mm-dd). */
  date: string
}

export type PsfFeedbackData = {
  sessions: PsfFeedbackSession[]
  completedAppointments: CompletedAppointment[]
}

/** Loads everything the client's "Feedback over time" page needs: every scored
 *  Post-Session Feedback (PSF) result, and every completed appointment (the denominator
 *  for the completion stat). Both come back unfiltered by date — the page filters
 *  client-side by the selected range, same pattern as AssessmentsTable's type filter. */
export async function loadPsfFeedbackForClient(
  clientId: string,
  practiceId: string
): Promise<PsfFeedbackData> {
  const psfResults = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      severity: assessmentResults.severity,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(
        assessmentResults.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, "PSF")
      )
    )

  const sessions: PsfFeedbackSession[] = []
  for (const row of psfResults) {
    const parsed = parsePsfSeverity(row.severity)
    // A PSF result should always have a parseable severity string (it's written by
    // formatPsfSeverity at submission time) — skip defensively rather than crash if an
    // old/corrupt row doesn't match.
    if (!parsed) continue
    sessions.push({
      assessmentResultId: row.assessmentResultId,
      date: toIsoDate(row.assessmentDate),
      positiveFeedback: parsed.positiveFeedback,
      negativeFeedback: parsed.negativeFeedback,
    })
  }

  const completedAppointmentRows = await db
    .select({
      appointmentId: appointments.appointmentId,
      appointmentDate: appointments.appointmentDate,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.practiceId, practiceId),
        eq(appointments.status, "completed")
      )
    )

  const completedAppointments: CompletedAppointment[] = completedAppointmentRows.map(
    (row) => ({
      appointmentId: row.appointmentId,
      date: toIsoDate(row.appointmentDate),
    })
  )

  return { sessions, completedAppointments }
}

function toIsoDate(value: Date | string): string {
  const raw = typeof value === "string" ? value : value.toISOString()
  return formatDateForInput(raw) || raw.slice(0, 10)
}
