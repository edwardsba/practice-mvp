import { formatAttemptDate, sortAttemptsChronologically } from "@/lib/treatment-plans/format-attempt-date"
import type { SuicideAttemptRecord } from "@/lib/treatment-plans/types"

export function buildSelfHarmHistorySentence(
  attempts: SuicideAttemptRecord[]
): string {
  if (attempts.length === 0) {
    return "The client denies any lifetime history of suicide attempts."
  }

  const sorted = sortAttemptsChronologically(attempts)
  const dates = sorted.map(formatAttemptDate)
  const dateList = formatDateList(dates)
  const noun = attempts.length === 1 ? "attempt" : "attempts"

  return `The client reports a lifetime history of ${attempts.length} suicide ${noun}, dated ${dateList}.`
}

function formatDateList(dates: string[]): string {
  if (dates.length === 1) return dates[0]
  if (dates.length === 2) return `${dates[0]} and ${dates[1]}`
  return `${dates.slice(0, -1).join(", ")}, and ${dates[dates.length - 1]}`
}
