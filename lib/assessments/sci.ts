const SCI_KEYS = [
  "sci_q1",
  "sci_q2",
  "sci_q3",
  "sci_q4",
  "sci_q5",
  "sci_q6",
  "sci_q7",
  "sci_q8",
]

// IMPORTANT: SCI is reverse-scored — higher total = better sleep, lower total = worse.
// This is the opposite direction from every other instrument in this battery, so a LOW
// score here is the clinically concerning result, not a high one.
// Simple sum, no missing-data proration defined for this instrument (all 8 items required).
// Range 0-32. Official validated cutoff: score <=16 meets threshold criteria for probable
// insomnia disorder (Espie et al., 2014); score >16 is below that threshold.
export function calculateSciScore(
  responses: { elementKey: string; scoreValue: number }[]
): number | null {
  const answered = responses.filter((r) => SCI_KEYS.includes(r.elementKey))
  if (answered.length !== SCI_KEYS.length) {
    return null
  }
  return answered.reduce((sum, r) => sum + r.scoreValue, 0)
}
