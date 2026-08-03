const ASRM_KEYS = ["asrm_q1", "asrm_q2", "asrm_q3", "asrm_q4", "asrm_q5"]

// ASRM missing-data rule: if 2+ of the 5 items are unanswered, the score is not calculated
// (returns null). If exactly 1 is unanswered (4/5 answered), prorate: (partial sum x 5) / 4,
// rounded to the nearest whole number. If all 5 are answered, sum directly. Range 0-20.
// Official cutoff: score >=6 indicates high probability of a manic or hypomanic condition.
export function calculateAsrmScore(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => ASRM_KEYS.includes(r.elementKey))
  const itemsMissing = ASRM_KEYS.length - answered.length

  if (itemsMissing >= 2) {
    return null
  }

  const partialSum = answered.reduce((sum, r) => sum + r.scoreValue, 0)

  if (itemsMissing === 0) {
    return partialSum
  }

  return Math.round((partialSum * 5) / answered.length)
}
