import { fromZonedTime } from "date-fns-tz"

import { PRACTICE_TIMEZONE } from "@/lib/dates/practice-time"

export const LATE_CANCELLATION_THRESHOLD_HOURS = 24
export const ATTENDANCE_WINDOW = 10
export const MINIMUM_SAMPLE = 3

export type ScorableAppointment = {
  status: string
  appointmentDate: string
  appointmentTime: string
  cancelledAt: Date | null
}

export type AttendanceRisk = {
  tier: "low" | "moderate" | "high" | "insufficient"
  score: number | null
  sampleSize: number
}

const TERMINAL_STATUSES = new Set(["completed", "no_show", "cancelled"])

function toAppointmentDateTime(appointment: ScorableAppointment): Date {
  const timeMatch = appointment.appointmentTime.match(/^(\d{2}):(\d{2})/)
  const hours = timeMatch?.[1] ?? "00"
  const minutes = timeMatch?.[2] ?? "00"
  const localDateTime = `${appointment.appointmentDate}T${hours}:${minutes}:00`

  return fromZonedTime(localDateTime, PRACTICE_TIMEZONE)
}

function sortKey(appointment: ScorableAppointment): string {
  const [hours = "00", minutes = "00", seconds = "00"] =
    appointment.appointmentTime.split(":")
  return `${appointment.appointmentDate}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`
}

function recencyWeight(index: number): number {
  return index <= 4 ? 1 : 0.5
}

function cancellationPoints(
  cancelledAt: Date | null,
  appointment: ScorableAppointment
): number {
  if (cancelledAt === null) {
    return 1
  }

  const appointmentDateTime = toAppointmentDateTime(appointment)
  const hoursUntilAppointment =
    (appointmentDateTime.getTime() - cancelledAt.getTime()) /
    (1000 * 60 * 60)

  if (hoursUntilAppointment >= LATE_CANCELLATION_THRESHOLD_HOURS) {
    return 1
  }

  return -3
}

function basePoints(appointment: ScorableAppointment): number {
  switch (appointment.status) {
    case "completed":
      return 3
    case "no_show":
      return -5
    case "cancelled":
      return cancellationPoints(appointment.cancelledAt, appointment)
    default:
      return 0
  }
}

function tierForScore(score: number): AttendanceRisk["tier"] {
  if (score >= 75) return "low"
  if (score >= 45) return "moderate"
  return "high"
}

export function calculateAttendanceRisk(
  appointments: ScorableAppointment[]
): AttendanceRisk {
  const terminal = appointments
    .filter((appointment) => TERMINAL_STATUSES.has(appointment.status))
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    .slice(0, ATTENDANCE_WINDOW)

  if (terminal.length < MINIMUM_SAMPLE) {
    return {
      tier: "insufficient",
      score: null,
      sampleSize: terminal.length,
    }
  }

  let actual = 0
  let max = 0
  let min = 0

  terminal.forEach((appointment, index) => {
    const weight = recencyWeight(index)
    const points = basePoints(appointment)

    actual += points * weight
    max += 3 * weight
    min += -5 * weight
  })

  if (max === min) {
    return {
      tier: "low",
      score: 100,
      sampleSize: terminal.length,
    }
  }

  const normalised = Math.round(((actual - min) / (max - min)) * 100)

  return {
    tier: tierForScore(normalised),
    score: normalised,
    sampleSize: terminal.length,
  }
}
