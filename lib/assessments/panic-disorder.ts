const PANIC_DISORDER_KEYS = [
  "panic_disorder_q1",
  "panic_disorder_q2",
  "panic_disorder_q3",
  "panic_disorder_q4",
  "panic_disorder_q5",
  "panic_disorder_q6",
  "panic_disorder_q7",
  "panic_disorder_q8",
  "panic_disorder_q9",
  "panic_disorder_q10",
]

// Panic Disorder missing-data rule: if 3+ of the 10 items are unanswered, the score is not
// calculated (returns null). If 1-2 are unanswered, prorate: (partial sum x 10) / items
// answered, rounded to the nearest whole number. If all 10 are answered, sum directly.
// Range is 0-40. Severity is interpreted from the AVERAGE score (raw / 10), not the raw sum
// directly — see anxietySubtypeSeverityFromScore in severity.ts, which does that division
// internally, so callers pass the raw sum straight through.
export function calculatePanicDisorderScore(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => PANIC_DISORDER_KEYS.includes(r.elementKey))
  const itemsMissing = PANIC_DISORDER_KEYS.length - answered.length

  if (itemsMissing >= 3) {
    return null
  }

  const partialSum = answered.reduce((sum, r) => sum + r.scoreValue, 0)

  if (itemsMissing === 0) {
    return partialSum
  }

  return Math.round((partialSum * 10) / answered.length)
}
