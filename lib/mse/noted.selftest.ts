import assert from "node:assert/strict"

import {
  isMseAnswerNoted,
  mseSeverityFromNotedCount,
  scoreMseNoted,
  type MseNotedAnswer,
} from "./noted"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check("severity 0 → Within limits", mseSeverityFromNotedCount(0), "Within limits")
check("severity 1 → 1 noted", mseSeverityFromNotedCount(1), "1 noted")
check("severity 2 → 2 noted", mseSeverityFromNotedCount(2), "2 noted")

check(
  "Insight Fair is not noted",
  isMseAnswerNoted({
    elementKey: "mse_insight",
    optionLabel: "Fair",
    isReportingBaseline: false,
  }),
  false
)

check(
  "Insight Good is not noted",
  isMseAnswerNoted({
    elementKey: "mse_insight",
    optionLabel: "Good",
    isReportingBaseline: true,
  }),
  false
)

check(
  "Insight Poor is noted",
  isMseAnswerNoted({
    elementKey: "mse_insight",
    optionLabel: "Poor",
    isReportingBaseline: false,
  }),
  true
)

check(
  "Judgement Fair is not noted",
  isMseAnswerNoted({
    elementKey: "mse_judgement",
    optionLabel: "Fair",
    isReportingBaseline: false,
  }),
  false
)

check(
  "Judgement Poor is noted",
  isMseAnswerNoted({
    elementKey: "mse_judgement",
    optionLabel: "Poor",
    isReportingBaseline: false,
  }),
  true
)

check(
  "non-baseline Appearance is noted",
  isMseAnswerNoted({
    elementKey: "mse_appearance",
    optionLabel: "Dishevelled",
    isReportingBaseline: false,
  }),
  true
)

check(
  "baseline Appearance is not noted",
  isMseAnswerNoted({
    elementKey: "mse_appearance",
    optionLabel: "Neat",
    isReportingBaseline: true,
  }),
  false
)

const allBaselineDefaults: MseNotedAnswer[] = [
  { elementKey: "mse_appearance", optionLabel: "Neat", isReportingBaseline: true },
  { elementKey: "mse_behaviour", optionLabel: "Cooperative", isReportingBaseline: true },
  { elementKey: "mse_insight", optionLabel: "Fair", isReportingBaseline: false },
  { elementKey: "mse_judgement", optionLabel: "Fair", isReportingBaseline: false },
]

{
  const result = scoreMseNoted(allBaselineDefaults)
  check("defaults with Fair insight/judgement → Within limits", result.severity, "Within limits")
  check("defaults notedCount 0", result.notedCount, 0)
  check("defaults notedElementKeys empty", result.notedElementKeys, [])
  check("structured_score_json shape", result.structuredScoreJson, {
    notedCount: 0,
    notedElementKeys: [],
  })
}

{
  const result = scoreMseNoted([
    ...allBaselineDefaults.slice(0, 2),
    { elementKey: "mse_insight", optionLabel: "Poor", isReportingBaseline: false },
    { elementKey: "mse_behaviour", optionLabel: "Guarded", isReportingBaseline: false },
  ])
  check("2 noted severity", result.severity, "2 noted")
  check("2 noted keys in order", result.notedElementKeys, [
    "mse_insight",
    "mse_behaviour",
  ])
}

console.log("\nAll mse noted-count checks passed.")
