const PART_A_LOW_THRESHOLD_KEYS = ["asrs_a_q1", "asrs_a_q2", "asrs_a_q3"] // count as a "hit" at Sometimes(3) or higher
const PART_A_HIGH_THRESHOLD_KEYS = ["asrs_a_q4", "asrs_a_q5", "asrs_a_q6"] // count as a "hit" at Often(4) or higher

export type AsrsPartAScore = {
  hitCount: number
  positive: boolean
}

// Part A "positive screen" uses a per-item shaded-box threshold, NOT a uniform cutoff —
// items 1-3 count as a hit at Sometimes-or-higher, items 4-6 count as a hit at Often-or-higher.
// Score >=4 of 6 hits = positive screen, triggers Part B.
export function calculateAsrsPartAScore(
  responses: { elementKey: string; scoreValue: number }[]
): AsrsPartAScore {
  const scoreByKey = new Map(responses.map((r) => [r.elementKey, r.scoreValue]))

  let hitCount = 0
  for (const key of PART_A_LOW_THRESHOLD_KEYS) {
    const score = scoreByKey.get(key)
    if (score !== undefined && score >= 3) hitCount++
  }
  for (const key of PART_A_HIGH_THRESHOLD_KEYS) {
    const score = scoreByKey.get(key)
    if (score !== undefined && score >= 4) hitCount++
  }

  return { hitCount, positive: hitCount >= 4 }
}

// Part B has no standalone score of its own — the Inattention/Hyperactivity subscale sums it
// contributes to need items from BOTH Part A and Part B. That combination happens downstream
// (at report-generation time, reading both instances together), not here. This function just
// captures Part B's own raw per-item scores so nothing is lost.
export function calculateAsrsPartBRawScores(
  responses: { elementKey: string; scoreValue: number }[]
): Record<string, number> {
  const raw: Record<string, number> = {}
  for (const response of responses) {
    raw[response.elementKey] = response.scoreValue
  }
  return raw
}
