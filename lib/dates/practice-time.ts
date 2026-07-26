import { addDays, format } from "date-fns"
import { fromZonedTime, toZonedTime } from "date-fns-tz"

/**
 * Single source of truth for "what timezone is this practice in."
 *
 * Hardcoded for now — this is a single-practice deployment. If this
 * ever becomes multi-practice / multi-timezone, this is the one place
 * to change: swap the constant for an async lookup of the practice's
 * configured timezone (e.g. a field on practitionerProfiles).
 *
 * One thing to know before making that change: the cron sweep in
 * lib/appointments/run-automations.ts currently computes "today" ONCE per
 * run, globally, and compares every practice's appointments against it.
 * A per-practice timezone would need that sweep to compute "today" per
 * practice inside the loop instead — a change to the query shape, not
 * just this constant.
 */
export const PRACTICE_TIMEZONE = "Australia/Sydney"

/** @deprecated use PRACTICE_TIMEZONE — kept as an alias so existing imports don't break */
export const SYDNEY_TIMEZONE = PRACTICE_TIMEZONE

/** Today's date, in the practice's local timezone, as "yyyy-MM-dd". */
export function todayDateString(): string {
  return format(toZonedTime(new Date(), PRACTICE_TIMEZONE), "yyyy-MM-dd")
}

/** Today + N days, in the practice's local timezone, as "yyyy-MM-dd". */
export function sydneyDatePlusDays(days: number): string {
  const practiceNow = toZonedTime(new Date(), PRACTICE_TIMEZONE)
  return format(addDays(practiceNow, days), "yyyy-MM-dd")
}

/**
 * Converts a local practice-timezone date+time into a UTC Date instant.
 * Use when you have a wall-clock date/time (e.g. an appointment's date
 * and time fields) and need an actual timestamp for comparison/storage.
 */
export function practiceLocalToUtc(localDateTime: Date): Date {
  return fromZonedTime(localDateTime, PRACTICE_TIMEZONE)
}

/**
 * Computes the actual end-time instant of an appointment, as a UTC Date.
 * Combines the appointment's local wall-clock date + time with its
 * duration, in the practice's timezone.
 */
export function appointmentEndTimeUtc(
  appointmentDate: string,
  appointmentTime: string,
  durationMinutes: number
): Date {
  const [hours, minutes] = appointmentTime.split(":").map(Number)
  const [year, month, day] = appointmentDate.split("-").map(Number)
  const localStart = new Date(year, month - 1, day, hours, minutes, 0, 0)
  const localEnd = new Date(localStart.getTime() + durationMinutes * 60_000)
  return practiceLocalToUtc(localEnd)
}

/**
 * Safely formats a stored date value for a `<input type="date">` field.
 * Plain "yyyy-MM-dd" values pass through unchanged. Values with a time
 * component are converted through the practice's local timezone (not
 * UTC) so the calendar date shown always matches what a person in the
 * practice's timezone would call "that day."
 */
export function formatDateForInput(value: string | null): string {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const raw = value.includes("T") ? value : `${value}T00:00:00`
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ""
  return format(toZonedTime(date, PRACTICE_TIMEZONE), "yyyy-MM-dd")
}

/** Today's date in the practice's local timezone, for defaulting a date input. */
export function todayDateInput(): string {
  return todayDateString()
}
