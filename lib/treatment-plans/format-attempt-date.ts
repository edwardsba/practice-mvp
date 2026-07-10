import type { SuicideAttemptRecord } from "./types"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function formatAttemptDate(attempt: SuicideAttemptRecord): string {
  if (attempt.day && attempt.month) {
    return `${attempt.day} ${MONTH_NAMES[attempt.month - 1]} ${attempt.year}`
  }
  if (attempt.month) {
    return `${MONTH_NAMES[attempt.month - 1]} ${attempt.year}`
  }
  return `${attempt.year}`
}

export function sortAttemptsChronologically(
  attempts: SuicideAttemptRecord[]
): SuicideAttemptRecord[] {
  return [...attempts].sort((a, b) => {
    const aKey = a.year * 10000 + (a.month ?? 1) * 100 + (a.day ?? 1)
    const bKey = b.year * 10000 + (b.month ?? 1) * 100 + (b.day ?? 1)
    return aKey - bKey
  })
}
