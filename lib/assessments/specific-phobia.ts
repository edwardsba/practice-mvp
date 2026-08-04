const SPECIFIC_PHOBIA_KEYS = [
  "specific_phobia_q1",
  "specific_phobia_q2",
  "specific_phobia_q3",
  "specific_phobia_q4",
  "specific_phobia_q5",
  "specific_phobia_q6",
  "specific_phobia_q7",
  "specific_phobia_q8",
  "specific_phobia_q9",
  "specific_phobia_q10",
]

// Specific Phobia missing-data rule: if 3+ of the 10 items are unanswered, the score is not
// calculated (returns null). If 1-2 are unanswered, prorate: (partial sum x 10) / items
// answered, rounded to the nearest whole number. If all 10 are answered, sum directly.
// Range is 0-40. Severity is interpreted from the AVERAGE score (raw / 10), not the raw sum
// directly — see anxietySubtypeSeverityFromScore in severity.ts, which does that division
// internally, so callers pass the raw sum straight through.
export function calculateSpecificPhobiaScore(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => SPECIFIC_PHOBIA_KEYS.includes(r.elementKey))
  const itemsMissing = SPECIFIC_PHOBIA_KEYS.length - answered.length

  if (itemsMissing >= 3) {
    return null
  }

  const partialSum = answered.reduce((sum, r) => sum + r.scoreValue, 0)

  if (itemsMissing === 0) {
    return partialSum
  }

  return Math.round((partialSum * 10) / answered.length)
}
