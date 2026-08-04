// PCL-5 — 20 items, 0-4 scale, sum for a total score (0-80). No official missing-data/proration
// policy is published (unlike the APA family of measures) — this just sums whatever's answered,
// which in practice is always all 20 given the app currently requires full completion anyway.
const CRITERION_B_KEYS = ["pcl5_q1", "pcl5_q2", "pcl5_q3", "pcl5_q4", "pcl5_q5"]
const CRITERION_C_KEYS = ["pcl5_q6", "pcl5_q7"]
const CRITERION_D_KEYS = [
  "pcl5_q8",
  "pcl5_q9",
  "pcl5_q10",
  "pcl5_q11",
  "pcl5_q12",
  "pcl5_q13",
  "pcl5_q14",
]
const CRITERION_E_KEYS = ["pcl5_q15", "pcl5_q16", "pcl5_q17", "pcl5_q18", "pcl5_q19", "pcl5_q20"]

// An item counts as "endorsed" at 2 (Moderately) or higher — per the DSM-5 diagnostic rule,
// not the same thing as a nonzero response.
const ENDORSEMENT_THRESHOLD = 2

export type Pcl5CriterionResult = {
  endorsedCount: number
  meetsThreshold: boolean
}

export type Pcl5StructuredScore = {
  criterionB: Pcl5CriterionResult // needs >= 1 endorsed of 5
  criterionC: Pcl5CriterionResult // needs >= 1 endorsed of 2
  criterionD: Pcl5CriterionResult // needs >= 2 endorsed of 7
  criterionE: Pcl5CriterionResult // needs >= 2 endorsed of 6
  meetsProvisionalDiagnosisCriteria: boolean
}

function scoreCriterion(
  scoreByKey: Map<string, number>,
  keys: string[],
  requiredCount: number
): Pcl5CriterionResult {
  const endorsedCount = keys.filter(
    (key) => (scoreByKey.get(key) ?? 0) >= ENDORSEMENT_THRESHOLD
  ).length
  return { endorsedCount, meetsThreshold: endorsedCount >= requiredCount }
}

export function calculatePcl5TotalScore(
  responses: { elementKey: string; scoreValue: number }[]
): number {
  return responses.reduce((sum, r) => sum + r.scoreValue, 0)
}

export function calculatePcl5StructuredScore(
  responses: { elementKey: string; scoreValue: number }[]
): Pcl5StructuredScore {
  const scoreByKey = new Map(responses.map((r) => [r.elementKey, r.scoreValue]))

  const criterionB = scoreCriterion(scoreByKey, CRITERION_B_KEYS, 1)
  const criterionC = scoreCriterion(scoreByKey, CRITERION_C_KEYS, 1)
  const criterionD = scoreCriterion(scoreByKey, CRITERION_D_KEYS, 2)
  const criterionE = scoreCriterion(scoreByKey, CRITERION_E_KEYS, 2)

  return {
    criterionB,
    criterionC,
    criterionD,
    criterionE,
    meetsProvisionalDiagnosisCriteria:
      criterionB.meetsThreshold &&
      criterionC.meetsThreshold &&
      criterionD.meetsThreshold &&
      criterionE.meetsThreshold,
  }
}

// Composes both interpretation methods into one short label, since the results page only has
// room for a single-line severity string (see app/clients/[client_id]/results/[result_id]/page.tsx).
// The 28-30 range isn't covered by either of the source doc's two published bands (<28 and
// 31-33+) — "Borderline" here is this build's own interpretive label for that gap, not
// something the source specifies. Discordant cases (e.g. score under 28 but DSM-5 criteria
// technically met) are deliberately not flagged specially here — left visible as-is, to be
// caught by clinical review when both figures are surfaced together in the eventual report.
export function pcl5SeverityLabel(totalScore: number, structuredScore: Pcl5StructuredScore): string {
  const scoreBand =
    totalScore < 28
      ? "Likely below clinical threshold"
      : totalScore < 31
        ? "Borderline"
        : "Probable PTSD indicated (provisional)"

  const criteriaLabel = structuredScore.meetsProvisionalDiagnosisCriteria
    ? "DSM-5 criteria met"
    : "DSM-5 criteria not met"

  return `${scoreBand} — ${criteriaLabel}`
}
