const SOCIAL_ANXIETY_KEYS = [
  "social_anxiety_q1",
  "social_anxiety_q2",
  "social_anxiety_q3",
  "social_anxiety_q4",
  "social_anxiety_q5",
  "social_anxiety_q6",
  "social_anxiety_q7",
  "social_anxiety_q8",
  "social_anxiety_q9",
  "social_anxiety_q10",
]

// Social Anxiety Disorder missing-data rule: if 3+ of the 10 items are unanswered, the score is not
// calculated (returns null). If 1-2 are unanswered, prorate: (partial sum x 10) / items
// answered, rounded to the nearest whole number. If all 10 are answered, sum directly.
// Range is 0-40. Severity is interpreted from the AVERAGE score (raw / 10), not the raw sum
// directly — see anxietySubtypeSeverityFromScore in severity.ts, which does that division
// internally, so callers pass the raw sum straight through.
export function calculateSocialAnxietyScore(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => SOCIAL_ANXIETY_KEYS.includes(r.elementKey))
  const itemsMissing = SOCIAL_ANXIETY_KEYS.length - answered.length

  if (itemsMissing >= 3) {
    return null
  }

  const partialSum = answered.reduce((sum, r) => sum + r.scoreValue, 0)

  if (itemsMissing === 0) {
    return partialSum
  }

  return Math.round((partialSum * 10) / answered.length)
}
