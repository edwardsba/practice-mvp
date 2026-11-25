import assert from "node:assert/strict"

import {
  buildAnswerSections,
  type AnswerRow,
} from "@/lib/assessments/answer-rows"
import { LRAMP_ELEMENTS } from "@/lib/assessments/definitions/lramp"
import type { FormAnswers } from "@/lib/assessments/form-rules"

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

/** Matches Ben01-style summary counts: C 4 Yes; D 4 Yes · 1 Somewhat. */
function ben01LikeAnswers(): FormAnswers {
  const answers: FormAnswers = {
    lramp_a1: ["history_at_intake"],
    lramp_a2: ["Client reported increased ideation after argument."],
    lramp_b1: ["yes"],
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

  answers.lramp_e1 = ["yes"]
  answers.lramp_e2 = ["no"]
  answers.lramp_e3 = ["no"]
  answers.lramp_e4 = ["yes"]
  answers.lramp_e4_techniques = ["validated_emotions", "coached_skills"]
  answers.lramp_e4_other = ["Custom technique note"]
  answers.lramp_e5 = ["yes"]
  answers.lramp_e6 = ["no"]
  answers.lramp_e7 = ["no"]
  answers.lramp_e8 = ["no"]
  answers.lramp_e9 = ["yes"]
  answers.lramp_e9_1 = ["yes"]
  answers.lramp_e9_1_notes = ["Scheduled for Thursday"]
  answers.lramp_e10 = ["no"]
  answers.lramp_e11_1 = ["yes"]
  answers.lramp_e11_2 = ["no"]
  answers.lramp_e11_2_reasons = ["client_refused"]
  answers.lramp_f1 = ["b"]
  answers.lramp_f2 = ["next_individual_session"]
  return answers
}

function b1NoAnswers(): FormAnswers {
  return {
    lramp_a1: ["new_ideation_or_urges"],
    lramp_a2: ["Deferred formal assessment."],
    lramp_b1: ["no"],
    lramp_b2: ["baseline_behaviours"],
    lramp_e1: ["yes"],
    lramp_e2: ["no"],
    lramp_e3: ["no"],
    lramp_e4: ["no"],
    lramp_e5: ["yes"],
    lramp_e6: ["no"],
    lramp_e7: ["no"],
    lramp_e8: ["no"],
    lramp_e9: ["no"],
    lramp_e10: ["no"],
    lramp_e11_1: ["yes"],
    lramp_e11_2: ["yes"],
    lramp_f1: ["a"],
    lramp_f2: ["24_hours"],
  }
}

function answerRows(
  sectionLetter: string,
  sections = buildAnswerSections(LRAMP_ELEMENTS, ben01LikeAnswers())
) {
  const section = sections.find((s) => s.letter === sectionLetter)
  assert.ok(section, `missing section ${sectionLetter}`)
  return section!.rows
}

function answerKeys(rows: AnswerRow[]): string[] {
  return rows
    .filter(
      (r): r is Extract<AnswerRow, { kind: "answer" }> => r.kind === "answer"
    )
    .map((r) => r.elementKey)
}

function subheadings(rows: AnswerRow[]): string[] {
  return rows
    .filter(
      (r): r is Extract<AnswerRow, { kind: "subheading" }> =>
        r.kind === "subheading"
    )
    .map((r) => r.label)
}

// --- B1 = Yes: C order + subheadings ---
{
  const cRows = answerRows("C")
  check("C subheadings in order", subheadings(cRows), [
    "Acute risk factors",
    "Population-specific risk factors",
  ])
  const keys = answerKeys(cRows)
  checkTrue(
    "C01 before C16",
    keys.indexOf("lramp_c01") < keys.indexOf("lramp_c16")
  )
  checkTrue(
    "Acute subheading before C01",
    cRows.findIndex(
      (r) => r.kind === "subheading" && r.label === "Acute risk factors"
    ) <
      cRows.findIndex(
        (r) => r.kind === "answer" && r.elementKey === "lramp_c01"
      )
  )
  checkTrue(
    "Population subheading before C16",
    cRows.findIndex(
      (r) =>
        r.kind === "subheading" &&
        r.label === "Population-specific risk factors"
    ) <
      cRows.findIndex(
        (r) => r.kind === "answer" && r.elementKey === "lramp_c16"
      )
  )
}

// --- Labels, not codes ---
{
  const bRows = answerRows("B")
  const b1 = bRows.find(
    (r): r is Extract<AnswerRow, { kind: "answer" }> =>
      r.kind === "answer" && r.elementKey === "lramp_b1"
  )
  check("B1 shows Yes label", b1?.answer, { kind: "text", value: "Yes" })
}

// --- Nested depth ---
{
  const eRows = answerRows("E")
  const e91 = eRows.find(
    (r): r is Extract<AnswerRow, { kind: "answer" }> =>
      r.kind === "answer" && r.elementKey === "lramp_e9_1"
  )
  const e112Reasons = eRows.find(
    (r): r is Extract<AnswerRow, { kind: "answer" }> =>
      r.kind === "answer" && r.elementKey === "lramp_e11_2_reasons"
  )
  check("E9.1 depth is 1", e91?.depth, 1)
  checkTrue(
    "E9.1 question uses short label",
    Boolean(e91?.question.startsWith("E9.1"))
  )
  check("E11.2 reasons depth is 2", e112Reasons?.depth, 2)
}

// --- E4 techniques + Other nested under E4 ---
{
  const eRows = answerRows("E")
  const keys = answerKeys(eRows)
  const e4 = keys.indexOf("lramp_e4")
  const tech = keys.indexOf("lramp_e4_techniques")
  const other = keys.indexOf("lramp_e4_other")
  checkTrue("E4 before techniques", e4 >= 0 && e4 < tech)
  checkTrue("techniques before other", tech < other)

  const e4Tech = LRAMP_ELEMENTS.find(
    (el) => el.elementKey === "lramp_e4_techniques"
  )!
  const expectedLabels = e4Tech.options
    .filter((o) =>
      ["validated_emotions", "coached_skills"].includes(o.value)
    )
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((o) => o.label)

  const techRow = eRows.find(
    (r): r is Extract<AnswerRow, { kind: "answer" }> =>
      r.kind === "answer" && r.elementKey === "lramp_e4_techniques"
  )
  check("E4 techniques labels in option order", techRow?.answer, {
    kind: "list",
    values: expectedLabels,
  })
  const otherRow = eRows.find(
    (r): r is Extract<AnswerRow, { kind: "answer" }> =>
      r.kind === "answer" && r.elementKey === "lramp_e4_other"
  )
  check("E4 other text_list", otherRow?.answer, {
    kind: "list",
    values: ["Custom technique note"],
  })
  check("E4 techniques depth 1", techRow?.depth, 1)
}

// --- text-list order ---
{
  const answers = ben01LikeAnswers()
  answers.lramp_c_comments = ["alpha", "beta", "gamma"]
  const sections = buildAnswerSections(LRAMP_ELEMENTS, answers)
  const cRows = sections.find((s) => s.letter === "C")!.rows
  const comments = cRows.find(
    (r): r is Extract<AnswerRow, { kind: "answer" }> =>
      r.kind === "answer" && r.elementKey === "lramp_c_comments"
  )
  check("text_list preserves response order", comments?.answer, {
    kind: "list",
    values: ["alpha", "beta", "gamma"],
  })
}

// --- unanswered optional left out ---
{
  const answers = ben01LikeAnswers()
  const sections = buildAnswerSections(LRAMP_ELEMENTS, answers)
  const cKeys = answerKeys(sections.find((s) => s.letter === "C")!.rows)
  checkTrue(
    "optional comments omitted when empty",
    !cKeys.includes("lramp_c_comments")
  )
}

// --- B1 = No: C and D skipped ---
{
  const sections = buildAnswerSections(LRAMP_ELEMENTS, b1NoAnswers())
  const c = sections.find((s) => s.letter === "C")!
  const d = sections.find((s) => s.letter === "D")!
  check("C skipped when B1=No", c.skipped, true)
  check("D skipped when B1=No", d.skipped, true)
  check("C has no rows when skipped", c.rows, [])
  check("D has no rows when skipped", d.rows, [])
  checkTrue("A not skipped", !sections.find((s) => s.letter === "A")!.skipped)
}

// --- date formatting ---
{
  const noPath: FormAnswers = {
    ...b1NoAnswers(),
    lramp_b4: ["ticked"],
    lramp_b4_follow_up: ["2026-11-27"],
  }
  const sections = buildAnswerSections(LRAMP_ELEMENTS, noPath)
  const bRows = sections.find((s) => s.letter === "B")!.rows
  const dateRow = bRows.find(
    (r): r is Extract<AnswerRow, { kind: "answer" }> =>
      r.kind === "answer" && r.elementKey === "lramp_b4_follow_up"
  )
  check("date formatted en-AU short month", dateRow?.answer, {
    kind: "text",
    value: "27 Nov 2026",
  })
}

console.log("answer-rows.selftest.ts: ok")
