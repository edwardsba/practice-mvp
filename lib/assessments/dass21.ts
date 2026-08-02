const DEPRESSION_KEYS = [
  "dass21_q3",
  "dass21_q5",
  "dass21_q10",
  "dass21_q13",
  "dass21_q16",
  "dass21_q17",
  "dass21_q21",
]
const ANXIETY_KEYS = [
  "dass21_q2",
  "dass21_q4",
  "dass21_q7",
  "dass21_q9",
  "dass21_q15",
  "dass21_q19",
  "dass21_q20",
]
const STRESS_KEYS = [
  "dass21_q1",
  "dass21_q6",
  "dass21_q8",
  "dass21_q11",
  "dass21_q12",
  "dass21_q14",
  "dass21_q18",
]

export type Dass21SubscaleScores = {
  depression: number
  anxiety: number
  stress: number
}

// Each subscale score = sum of its 7 raw item scores (0-21), multiplied by 2 to get the
// reportable score (0-42 per subscale) — required to match the standard DASS-21 severity
// bands, which were calibrated against the original 42-item DASS.
export function calculateDass21SubscaleScores(
  responses: { elementKey: string; scoreValue: number }[]
): Dass21SubscaleScores {
  const scoreByKey = new Map(responses.map((r) => [r.elementKey, r.scoreValue]))

  const sumKeys = (keys: string[]) =>
    keys.reduce((sum, key) => sum + (scoreByKey.get(key) ?? 0), 0)

  return {
    depression: sumKeys(DEPRESSION_KEYS) * 2,
    anxiety: sumKeys(ANXIETY_KEYS) * 2,
    stress: sumKeys(STRESS_KEYS) * 2,
  }
}
