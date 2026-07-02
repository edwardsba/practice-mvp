import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/appointments/constants"
import { PRACTICE_TIMEZONE } from "@/lib/dates/practice-time"

export {
  PRACTICE_TIMEZONE,
  SYDNEY_TIMEZONE,
  todayDateString,
  sydneyDatePlusDays,
  formatDateForInput,
  practiceLocalToUtc,
} from "@/lib/dates/practice-time"

export function formatAutomationTimestamp(value: Date | string | null): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PRACTICE_TIMEZONE,
  })
}

export function formatAppointmentDate(value: string | Date | null): string {
  if (!value) return "—"
  const date =
    value instanceof Date
      ? value
      : new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function formatAppointmentTime(value: string | null): string {
  if (!value) return "—"
  const [hours, minutes] = value.split(":").map((part) => Number(part))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatAppointmentDuration(minutes: number): string {
  return `${minutes} min`
}

export function formatClientNameLastFirst(
  firstName: string,
  lastName: string
): string {
  return `${lastName}, ${firstName}`
}

export function formatAppointmentStatus(status: string): string {
  if (status in APPOINTMENT_STATUS_LABELS) {
    return APPOINTMENT_STATUS_LABELS[status as AppointmentStatus]
  }
  return status
}

export function formatTimeForInput(value: string | null): string {
  if (!value) return ""
  const match = value.match(/^(\d{2}):(\d{2})/)
  if (!match) return value
  return `${match[1]}:${match[2]}:00`
}
