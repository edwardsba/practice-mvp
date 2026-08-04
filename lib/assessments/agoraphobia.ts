const AGORAPHOBIA_KEYS = [
  "agoraphobia_q1",
  "agoraphobia_q2",
  "agoraphobia_q3",
  "agoraphobia_q4",
  "agoraphobia_q5",
  "agoraphobia_q6",
  "agoraphobia_q7",
  "agoraphobia_q8",
  "agoraphobia_q9",
  "agoraphobia_q10",
]

// Agoraphobia missing-data rule: if 3+ of the 10 items are unanswered, the score is not
// calculated (returns null). If 1-2 are unanswered, prorate: (partial sum x 10) / items
// answered, rounded to the nearest whole number. If all 10 are answered, sum directly.
// Range is 0-40. Severity is interpreted from the AVERAGE score (raw / 10), not the raw sum
// directly — see anxietySubtypeSeverityFromScore in severity.ts, which does that division
// internally, so callers pass the raw sum straight through.
export function calculateAgoraphobiaScore(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => AGORAPHOBIA_KEYS.includes(r.elementKey))
  const itemsMissing = AGORAPHOBIA_KEYS.length - answered.length

  if (itemsMissing >= 3) {
    return null
  }

  const partialSum = answered.reduce((sum, r) => sum + r.scoreValue, 0)

  if (itemsMissing === 0) {
    return partialSum
  }

  return Math.round((partialSum * 10) / answered.length)
}
