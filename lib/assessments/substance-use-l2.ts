const SUBSTANCE_LABELS: Record<string, string> = {
  a: "painkillers",
  b: "stimulants",
  c: "sedatives",
  d: "marijuana",
  e: "cocaine",
  f: "club_drugs",
  g: "hallucinogens",
  h: "heroin",
  i: "inhalants",
  j: "methamphetamine",
}

export type SubstanceUseL2Scores = {
  endorsedCount: number
  itemScores: Record<string, number>
}

// Each of the 10 substances is scored independently (0-4, past-2-weeks frequency) — there's
// no composite total per the reference instrument. endorsedCount (how many substances scored
// >0) is included as a single numeric field so a battery trigger rule can fire "Part 2" (the
// existing ASSIST assessment) whenever any substance was used in the past 2 weeks.
export function calculateSubstanceUseL2Scores(
  responses: { elementKey: string; scoreValue: number }[]
): SubstanceUseL2Scores {
  const itemScores: Record<string, number> = {}
  let endorsedCount = 0

  for (const response of responses) {
    const key = response.elementKey.replace("substance_use_l2_", "")
    const label = SUBSTANCE_LABELS[key]
    if (!label) continue
    itemScores[label] = response.scoreValue
    if (response.scoreValue > 0) endorsedCount++
  }

  return { endorsedCount, itemScores }
}
