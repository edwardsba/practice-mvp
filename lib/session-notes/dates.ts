import { format } from "date-fns"
import { toZonedTime } from "date-fns-tz"

import { PRACTICE_TIMEZONE } from "@/lib/dates/practice-time"

export function assessmentDateMatchesSessionDate(
  assessmentDate: Date,
  sessionDate: string
): boolean {
  const zoned = toZonedTime(assessmentDate, PRACTICE_TIMEZONE)
  const dateStr = format(zoned, "yyyy-MM-dd")
  return dateStr === sessionDate
}

export function timestampMatchesSessionDate(
  value: Date,
  sessionDate: string
): boolean {
  return assessmentDateMatchesSessionDate(value, sessionDate)
}
