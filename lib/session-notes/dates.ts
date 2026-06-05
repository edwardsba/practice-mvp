import { format } from "date-fns"
import { toZonedTime } from "date-fns-tz"

import { SYDNEY_TIMEZONE } from "@/lib/appointments/format"

export function assessmentDateMatchesSessionDate(
  assessmentDate: Date,
  sessionDate: string
): boolean {
  const zoned = toZonedTime(assessmentDate, SYDNEY_TIMEZONE)
  const dateStr = format(zoned, "yyyy-MM-dd")
  return dateStr === sessionDate
}

export function timestampMatchesSessionDate(
  value: Date,
  sessionDate: string
): boolean {
  return assessmentDateMatchesSessionDate(value, sessionDate)
}
