import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import { resolveAppointmentLocationText } from "@/lib/appointments/location"
import {
  SESSION_NOTE_STATUS_LABELS,
  type SessionNoteStatus,
} from "@/lib/session-notes/constants"

export function formatSessionNoteDate(value: string | Date | null): string {
  return formatAppointmentDate(value)
}

export function formatSessionNoteTime(value: string | null): string {
  if (!value) return "—"
  return formatAppointmentTime(value)
}

export function formatSessionNoteStatus(status: string): string {
  if (status in SESSION_NOTE_STATUS_LABELS) {
    return SESSION_NOTE_STATUS_LABELS[status as SessionNoteStatus]
  }
  return status
}

export function formatNextAppointmentLine(
  appointmentDate: string,
  appointmentTime: string,
  location: string | null,
  mode: string,
  locationNickname: string | null,
  practiceAddress: string | null,
  practiceName: string
): string {
  const datePart = formatAppointmentDate(appointmentDate)
  const timePart = formatAppointmentTime(appointmentTime)
  const locationPart =
    mode === "online"
      ? "Online"
      : resolveAppointmentLocationText(
          location,
          locationNickname,
          practiceAddress,
          practiceName
        )
  return `${datePart} at ${timePart} — ${locationPart}`
}

export type PsqStatus = "not_sent" | "sent" | "completed"

export function derivePsqStatus(
  preSessionBatterySentAt: Date | null | undefined,
  batteryStatus: string | null | undefined
): PsqStatus {
  if (batteryStatus === "submitted") return "completed"
  if (preSessionBatterySentAt != null) return "sent"
  return "not_sent"
}

export type AssessmentCompletionStatus = "not_done" | "completed"

export type AsqStatus = AssessmentCompletionStatus

/** Shared completion status for assessments without scored results (and ASQ). */
export function deriveAssessmentStatus(
  instance:
    | { status?: string | null; submittedAt?: Date | string | null }
    | null
    | undefined
): AssessmentCompletionStatus {
  if (!instance) return "not_done"
  if (instance.status === "submitted" || instance.submittedAt != null) {
    return "completed"
  }
  return "not_done"
}

export function deriveAsqStatus(
  asqCompleted: boolean | null | undefined
): AsqStatus {
  return deriveAssessmentStatus(
    asqCompleted ? { status: "submitted", submittedAt: new Date(0) } : null
  )
}
