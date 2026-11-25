import assert from "node:assert/strict"

import { LRAMP_ELEMENTS } from "@/lib/assessments/definitions/lramp"
import type { FormAnswers } from "@/lib/assessments/form-rules"
import {
  lrampResultSummary,
  lrampShortDisposition,
} from "@/lib/assessments/lramp-summary"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function checkTrue(name: string, value: boolean) {
  assert.equal(value, true, name)
  console.log(`ok — ${name}`)
}

function fillRiskSection(
  answers: FormAnswers,
  prefix: "lramp_c" | "lramp_d",
  count: number,
  value: string
) {
  for (let i = 1; i <= count; i++) {
    answers[`${prefix}${String(i).padStart(2, "0")}`] = [value]
  }
}

function ben01LikeAnswers(): FormAnswers {
  const answers: FormAnswers = {
    lramp_b1: ["yes"],
    lramp_f1: ["b"],
    lramp_f2: ["next_individual_session"],
  }
  fillRiskSection(answers, "lramp_c", 19, "no")
  answers.lramp_c01 = ["yes"]
  answers.lramp_c02 = ["yes"]
  answers.lramp_c03 = ["yes"]
  answers.lramp_c04 = ["yes"]
  fillRiskSection(answers, "lramp_d", 11, "no")
  answers.lramp_d01 = ["yes"]
  answers.lramp_d02 = ["yes"]
  answers.lramp_d03 = ["yes"]
  answers.lramp_d04 = ["yes"]
  answers.lramp_d05 = ["somewhat"]
  return answers
}

{
  const summary = lrampResultSummary(ben01LikeAnswers(), LRAMP_ELEMENTS)
  const byLabel = Object.fromEntries(summary.map((r) => [r.label, r]))

  check("disposition lead B.", byLabel["Final disposition"]?.lead, "B.")
  checkTrue(
    "disposition full label mentions imminent danger",
    Boolean(
      byLabel["Final disposition"]?.value
        .toLowerCase()
        .includes("some imminent danger")
    )
  )
  check(
    "re-evaluate next individual session",
    byLabel["Re-evaluate"]?.value,
    "Next individual session"
  )
  check("formal assessment conducted", byLabel["Formal assessment"]?.value, "Conducted")
  check("risk 4 Yes", byLabel["Risk factors"]?.value, "4 Yes")
  check(
    "protective 4 Yes · 1 Somewhat",
    byLabel["Protective factors"]?.value,
    "4 Yes · 1 Somewhat"
  )
}

{
  const answers: FormAnswers = {
    lramp_b1: ["no"],
    lramp_f1: ["a"],
    lramp_f2: ["24_hours"],
  }
  const summary = lrampResultSummary(answers, LRAMP_ELEMENTS)
  const byLabel = Object.fromEntries(summary.map((r) => [r.label, r]))
  check("B1=No formal not conducted", byLabel["Formal assessment"]?.value, "Not conducted")
  check("B1=No risk Not asked", byLabel["Risk factors"]?.value, "Not asked")
  check(
    "B1=No protective Not asked",
    byLabel["Protective factors"]?.value,
    "Not asked"
  )
}

{
  check(
    "short disposition B",
    lrampShortDisposition(LRAMP_ELEMENTS, { lramp_f1: ["b"] }),
    "B. Some imminent danger"
  )
  check(
    "short disposition null without F1",
    lrampShortDisposition(LRAMP_ELEMENTS, {}),
    null
  )
}

{
  const answers: FormAnswers = {
    lramp_b1: ["yes"],
    lramp_f1: ["a"],
    lramp_f2: ["next_individual_session"],
  }
  fillRiskSection(answers, "lramp_c", 19, "no")
  fillRiskSection(answers, "lramp_d", 11, "no")
  const summary = lrampResultSummary(answers, LRAMP_ELEMENTS)
  const byLabel = Object.fromEntries(summary.map((r) => [r.label, r]))
  check("all-no risk → None", byLabel["Risk factors"]?.value, "None")
  check("all-no protective → None", byLabel["Protective factors"]?.value, "None")
}

console.log("lramp-summary.selftest.ts: ok")
