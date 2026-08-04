export function calculatePcPtsd5Score(
  responses: { elementKey: string; scoreValue: number }[]
): number {
  // The gate item is a lifetime exposure question, not a symptom — excluded from the score.
  // If the gate is "No" (0), the screen total is 0 regardless of what the 5 symptom items say
  // — per the source doc's own "if No, screen total = 0, stop here." The frontend now hides
  // and auto-defaults those 5 items to "No" whenever the gate is "No", so in practice they'll
  // already be 0 — but this check makes it correct regardless of frontend state, not just
  // reliant on it.
  const gateResponse = responses.find((r) => r.elementKey === "pcptsd5_gate")
  if (gateResponse && gateResponse.scoreValue === 0) {
    return 0
  }

  // Score range is 0-5, one point per "Yes" on the 5 symptom items.
  return responses
    .filter((r) => r.elementKey !== "pcptsd5_gate")
    .reduce((sum, r) => sum + r.scoreValue, 0)
}
