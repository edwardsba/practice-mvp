import assert from "node:assert/strict"

import { asqResultSummary } from "@/lib/assessments/asq-summary"
import type { FormAnswers } from "@/lib/assessments/form-rules"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const answers: FormAnswers = {
  asq_q1: ["yes"],
  asq_q2: ["no"],
  asq_q3: ["yes"],
  asq_q4: ["no"],
  asq_q5: ["yes"],
}

check(
  "ASQ summary: screen outcome + Yes count, no acute",
  asqResultSummary(answers, [], {
    severity: "Recent and current TOSH",
  }),
  [
    { label: "Screen outcome", value: "Recent and current TOSH" },
    { label: "Questions answered Yes", value: "3 of 5" },
  ]
)

check(
  "ASQ summary: includes acute risk when set",
  asqResultSummary(answers, [], {
    severity: "Recent and current TOSH",
    acuteRiskRating: "High",
  }),
  [
    { label: "Screen outcome", value: "Recent and current TOSH" },
    { label: "Questions answered Yes", value: "3 of 5" },
    { label: "Acute risk rating", value: "High" },
  ]
)

check(
  "ASQ summary: missing severity → em dash",
  asqResultSummary(
    {
      asq_q1: ["no"],
      asq_q2: ["no"],
      asq_q3: ["no"],
      asq_q4: ["no"],
      asq_q5: ["no"],
    },
    [],
    {}
  ),
  [
    { label: "Screen outcome", value: "—" },
    { label: "Questions answered Yes", value: "0 of 5" },
  ]
)

console.log("asq-summary.selftest.ts: ok")
