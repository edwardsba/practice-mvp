const DES_B_KEYS = [
  "des_b_q1",
  "des_b_q2",
  "des_b_q3",
  "des_b_q4",
  "des_b_q5",
  "des_b_q6",
  "des_b_q7",
  "des_b_q8",
]

// DES-B missing-data rule: if 3+ of the 8 items are unanswered, the score is not calculated
// (returns null). If 1-2 are unanswered, prorate: (partial sum x 8) / items answered, rounded
// to the nearest whole number. If all 8 are answered, sum directly. Range is 0-32; the
// reference instrument also defines an "average total score" (score / 8, interpreted as
// none/mild/moderate/severe/extreme) but publishes no official numeric cutoff for it, so no
// severity band is auto-assigned here — same treatment as Substance Use L2.
export function calculateDesBScore(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => DES_B_KEYS.includes(r.elementKey))
  const itemsMissing = DES_B_KEYS.length - answered.length

  if (itemsMissing >= 3) {
    return null
  }

  const partialSum = answered.reduce((sum, r) => sum + r.scoreValue, 0)

  if (itemsMissing === 0) {
    return partialSum
  }

  return Math.round((partialSum * 8) / answered.length)
}
