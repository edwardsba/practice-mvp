const PART_A_LOW_THRESHOLD_KEYS = ["asrs_q1", "asrs_q2", "asrs_q3"] // count as a "hit" at Sometimes(3) or higher
const PART_A_HIGH_THRESHOLD_KEYS = ["asrs_q4", "asrs_q5", "asrs_q6"] // count as a "hit" at Often(4) or higher

const SUBSCALE_A_INATTENTION_KEYS = [
  "asrs_q1", "asrs_q2", "asrs_q3", "asrs_q4",
  "asrs_q7", "asrs_q8", "asrs_q9", "asrs_q10", "asrs_q11", "asrs_q12",
]

const SUBSCALE_B_HYPERACTIVITY_KEYS = [
  "asrs_q5", "asrs_q6",
  "asrs_q13", "asrs_q14", "asrs_q15", "asrs_q16", "asrs_q17", "asrs_q18",
]

export type AsrsScores = {
  partAHitCount: number
  partAPositive: boolean
  inattentionSubscaleSum: number | null // null until all 18 items are answered (Part B not yet completed)
  hyperactivitySubscaleSum: number | null
}

// Part A "positive screen" uses a per-item shaded-box threshold, NOT a uniform cutoff —
// items 1-3 count as a hit at Sometimes-or-higher, items 4-6 count as a hit at Often-or-higher.
// Score >=4 of 6 hits = positive screen, triggers Part B (items 7-18).
export function calculateAsrsScores(
  responses: { elementKey: string; scoreValue: number }[]
): AsrsScores {
  const scoreByKey = new Map(responses.map((r) => [r.elementKey, r.scoreValue]))

  let partAHitCount = 0
  for (const key of PART_A_LOW_THRESHOLD_KEYS) {
    const score = scoreByKey.get(key)
    if (score !== undefined && score >= 3) partAHitCount++
  }
  for (const key of PART_A_HIGH_THRESHOLD_KEYS) {
    const score = scoreByKey.get(key)
    if (score !== undefined && score >= 4) partAHitCount++
  }

  const allSubscaleKeys = [...SUBSCALE_A_INATTENTION_KEYS, ...SUBSCALE_B_HYPERACTIVITY_KEYS]
  const hasAllItems = allSubscaleKeys.every((key) => scoreByKey.has(key))

  return {
    partAHitCount,
    partAPositive: partAHitCount >= 4,
    inattentionSubscaleSum: hasAllItems
      ? SUBSCALE_A_INATTENTION_KEYS.reduce((sum, key) => sum + (scoreByKey.get(key) ?? 0), 0)
      : null,
    hyperactivitySubscaleSum: hasAllItems
      ? SUBSCALE_B_HYPERACTIVITY_KEYS.reduce((sum, key) => sum + (scoreByKey.get(key) ?? 0), 0)
      : null,
  }
}
