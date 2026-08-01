export function calculatePcPtsd5Score(
  responses: { elementKey: string; scoreValue: number }[]
): number {
  // The gate item (pcptsd5_gate) is an exposure question, not a symptom — excluded from the score.
  // Score range is 0-5, one point per "Yes" on the 5 symptom items.
  return responses
    .filter((r) => r.elementKey !== "pcptsd5_gate")
    .reduce((sum, r) => sum + r.scoreValue, 0)
}
