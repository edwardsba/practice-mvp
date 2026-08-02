const PHQ15_KEYS = [
  "phq15_q1",
  "phq15_q2",
  "phq15_q3",
  "phq15_q4",
  "phq15_q5",
  "phq15_q6",
  "phq15_q7",
  "phq15_q8",
  "phq15_q9",
  "phq15_q10",
  "phq15_q11",
  "phq15_q12",
  "phq15_q13",
  "phq15_q14",
  "phq15_q15",
]

// PHQ-15 missing-data rule: if 4+ of the 15 items are unanswered, the score is not
// calculated (returns null). If 1-3 are unanswered, prorate: (partial sum x 15) / items
// answered, rounded to the nearest whole number. If all 15 are answered, sum directly.
// Item 4 (menstrual cramps, women-only) is the most common source of a single missing item.
export function calculatePhq15Score(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => PHQ15_KEYS.includes(r.elementKey))
  const itemsMissing = PHQ15_KEYS.length - answered.length

  if (itemsMissing >= 4) {
    return null
  }

  const partialSum = answered.reduce((sum, r) => sum + r.scoreValue, 0)

  if (itemsMissing === 0) {
    return partialSum
  }

  return Math.round((partialSum * 15) / answered.length)
}
