export type Level1XcDomainScores = Record<string, number>

// Domain scoring rule: a domain's score is the MAX of its item scores, not a sum
// (e.g. Anxiety's score = max of items 6, 7, 8). This matches the APA's official scoring table.
export function calculateLevel1XcDomainScores(
  responses: { domainCode: string | null; scoreValue: number }[]
): Level1XcDomainScores {
  const domainScores: Level1XcDomainScores = {}

  for (const response of responses) {
    if (!response.domainCode) continue
    const current = domainScores[response.domainCode]
    domainScores[response.domainCode] =
      current === undefined ? response.scoreValue : Math.max(current, response.scoreValue)
  }

  return domainScores
}
