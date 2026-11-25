import assert from "node:assert/strict"

import { LRAMP_ELEMENTS } from "@/lib/assessments/definitions/lramp"
import {
  answersFromResponseRows,
  cleanAnswers,
  sectionStatuses,
  toResponseRows,
  validateAnswers,
  visibleElementKeys,
  type FormAnswers,
  type FormElement,
} from "@/lib/assessments/form-rules"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function checkTrue(name: string, value: boolean) {
  assert.equal(value, true, name)
  console.log(`ok — ${name}`)
}

const RISK = ["not_reported", "no", "somewhat", "yes"] as const

function fillRiskSection(
  answers: FormAnswers,
  prefix: "lramp_c" | "lramp_d",
  count: number,
  value: (typeof RISK)[number] = "no"
) {
  for (let i = 1; i <= count; i++) {
    answers[`${prefix}${String(i).padStart(2, "0")}`] = [value]
  }
}

/** Minimal valid E+F answers shared by both B1 paths. */
function baseEF(answers: FormAnswers) {
  answers.lramp_e1 = ["yes"]
  answers.lramp_e2 = ["no"]
  answers.lramp_e3 = ["no"]
  answers.lramp_e4 = ["no"]
  answers.lramp_e5 = ["yes"]
  answers.lramp_e6 = ["no"]
  answers.lramp_e7 = ["no"]
  answers.lramp_e8 = ["no"]
  answers.lramp_e9 = ["no"]
  answers.lramp_e10 = ["no"]
  answers.lramp_e11_1 = ["yes"]
  answers.lramp_e11_2 = ["yes"]
  answers.lramp_f1 = ["a"]
  answers.lramp_f2 = ["24_hours"]
}

function validB1Yes(): FormAnswers {
  const answers: FormAnswers = {
    lramp_a1: ["history_at_intake"],
    lramp_a2: ["Client reported increased ideation after argument."],
    lramp_b1: ["yes"],
  }
  fillRiskSection(answers, "lramp_c", 19, "no")
  fillRiskSection(answers, "lramp_d", 11, "somewhat")
  baseEF(answers)
  return answers
}

function validB1No(): FormAnswers {
  const answers: FormAnswers = {
    lramp_a1: ["new_ideation_or_urges"],
    lramp_a2: ["Urges reported; structured assessment deferred."],
    lramp_b1: ["no"],
    lramp_b2: ["baseline_behaviours"],
  }
  baseEF(answers)
  return answers
}

// ---------------------------------------------------------------------------
// Synthetic mini form (cleanAnswers / toResponseRows basics)
// ---------------------------------------------------------------------------

const SYNTH: FormElement[] = [
  {
    elementKey: "root",
    elementType: "yes_no",
    questionText: "Root",
    groupLabel: null,
    subgroupLabel: null,
    displayOrder: 10,
    isRequired: true,
    parentElementKey: null,
    showWhen: null,
    requiredGroupKey: null,
    helpText: null,
    options: [
      { label: "Yes", value: "yes", displayOrder: 1, scoreValue: 1 },
      { label: "No", value: "no", displayOrder: 2, scoreValue: 0 },
    ],
  },
  {
    elementKey: "child_list",
    elementType: "text_list",
    questionText: "List",
    groupLabel: null,
    subgroupLabel: null,
    displayOrder: 20,
    isRequired: false,
    parentElementKey: "root",
    showWhen: { key: "root", in: ["yes"] },
    requiredGroupKey: null,
    helpText: null,
    options: [],
  },
  {
    elementKey: "hidden_when_no",
    elementType: "short_text",
    questionText: "Hidden",
    groupLabel: null,
    subgroupLabel: null,
    displayOrder: 30,
    isRequired: true,
    parentElementKey: "root",
    showWhen: { key: "root", in: ["yes"] },
    requiredGroupKey: null,
    helpText: null,
    options: [],
  },
  {
    elementKey: "scored_radio",
    elementType: "radio",
    questionText: "Score me",
    groupLabel: null,
    subgroupLabel: null,
    displayOrder: 40,
    isRequired: false,
    parentElementKey: null,
    showWhen: null,
    requiredGroupKey: null,
    helpText: null,
    options: [
      { label: "Low", value: "low", displayOrder: 1, scoreValue: 1 },
      { label: "High", value: "high", displayOrder: 2, scoreValue: 5 },
    ],
  },
]

{
  const dirty: FormAnswers = {
    root: ["no"],
    child_list: ["  keep  ", "", "  ", "two"],
    hidden_when_no: ["should drop"],
    scored_radio: ["high"],
  }
  const cleaned = cleanAnswers(SYNTH, dirty)
  check("9a. cleanAnswers drops hidden answers", cleaned, {
    root: ["no"],
    scored_radio: ["high"],
  })

  const withList: FormAnswers = {
    root: ["yes"],
    child_list: ["  alpha  ", "", "beta", "  "],
    scored_radio: ["low"],
  }
  const cleanedList = cleanAnswers(SYNTH, withList)
  check("9b. text-list blanks dropped and trimmed", cleanedList.child_list, [
    "alpha",
    "beta",
  ])

  const rows = toResponseRows(SYNTH, withList)
  const listRows = rows.filter((r) => r.elementKey === "child_list")
  check(
    "9c. toResponseRows numbers text_list 1,2,3",
    listRows.map((r) => ({
      value: r.responseValue,
      order: r.responseOrder,
      score: r.scoreValue,
    })),
    [
      { value: "alpha", order: 1, score: 0 },
      { value: "beta", order: 2, score: 0 },
    ]
  )

  const radioRow = rows.find((r) => r.elementKey === "scored_radio")
  check("9d. radio uses option score", radioRow?.scoreValue, 1)
}

// ---------------------------------------------------------------------------
// 1. B1 = Yes path visibility
// ---------------------------------------------------------------------------

{
  const answers = validB1Yes()
  const visible = visibleElementKeys(LRAMP_ELEMENTS, answers)

  for (const key of [
    "lramp_a1",
    "lramp_a2",
    "lramp_b1",
    "lramp_c01",
    "lramp_d01",
    "lramp_e1",
    "lramp_f1",
  ]) {
    checkTrue(`1. visible ${key} when B1=Yes`, visible.has(key))
  }
  for (const key of [
    "lramp_b2",
    "lramp_b3",
    "lramp_b4",
    "lramp_b5",
    "lramp_b3_referred_to",
    "lramp_b4_follow_up",
  ]) {
    checkTrue(`1. hidden ${key} when B1=Yes`, !visible.has(key))
  }
}

// ---------------------------------------------------------------------------
// 2. B1 = No path visibility
// ---------------------------------------------------------------------------

{
  const answers = validB1No()
  const visible = visibleElementKeys(LRAMP_ELEMENTS, answers)

  for (const key of [
    "lramp_b2",
    "lramp_b3",
    "lramp_b4",
    "lramp_b5",
    "lramp_e1",
    "lramp_f1",
  ]) {
    checkTrue(`2. visible ${key} when B1=No`, visible.has(key))
  }
  for (const key of ["lramp_c01", "lramp_c19", "lramp_d01", "lramp_d11", "lramp_c_comments", "lramp_d_comments"]) {
    checkTrue(`2. hidden ${key} when B1=No`, !visible.has(key))
  }
}

// ---------------------------------------------------------------------------
// 3. B1 = No required group + B4 date
// ---------------------------------------------------------------------------

{
  const none: FormAnswers = {
    ...validB1No(),
  }
  delete none.lramp_b2
  const errors = validateAnswers(LRAMP_ELEMENTS, none)
  const groupErrors = errors.filter(
    (e) => e.message === "Please answer at least one of these."
  )
  check(
    "3a. B1=No with no B2–B5 → one at-least-one error",
    groupErrors.length,
    1
  )
  checkTrue(
    "3a. error on first visible group member (b2)",
    groupErrors[0]?.elementKey === "lramp_b2"
  )

  const onlyB4: FormAnswers = {
    ...validB1No(),
  }
  delete onlyB4.lramp_b2
  onlyB4.lramp_b4 = ["ticked"]
  const b4Errors = validateAnswers(LRAMP_ELEMENTS, onlyB4)
  checkTrue(
    "3b. ticking only B4 requires B4 date",
    b4Errors.some((e) => e.elementKey === "lramp_b4_follow_up")
  )

  onlyB4.lramp_b4_follow_up = ["2026-11-26"]
  check(
    "3c. B4 + date clears B-group/date errors",
    validateAnswers(LRAMP_ELEMENTS, onlyB4).filter(
      (e) =>
        e.elementKey.startsWith("lramp_b") &&
        e.elementKey !== "lramp_b1"
    ),
    []
  )
}

// ---------------------------------------------------------------------------
// 4. E1 reasons
// ---------------------------------------------------------------------------

{
  const e1Yes: FormAnswers = { ...validB1Yes(), lramp_e1: ["yes"] }
  const visibleYes = visibleElementKeys(LRAMP_ELEMENTS, e1Yes)
  checkTrue(
    "4a. E1=Yes hides reasons",
    !visibleYes.has("lramp_e1_reasons") && !visibleYes.has("lramp_e1_other")
  )

  const e1No: FormAnswers = { ...validB1Yes(), lramp_e1: ["no"] }
  const errors = validateAnswers(LRAMP_ELEMENTS, e1No)
  checkTrue(
    "4b. E1=No with no reason/Other → group error",
    errors.some(
      (e) =>
        e.message === "Please answer at least one of these." &&
        (e.elementKey === "lramp_e1_reasons" || e.elementKey === "lramp_e1_other")
    )
  )

  e1No.lramp_e1_other = ["Clinician judgement"]
  check(
    "4c. E1=No with Other clears group error",
    validateAnswers(LRAMP_ELEMENTS, e1No).filter(
      (e) =>
        e.message === "Please answer at least one of these." &&
        (e.elementKey === "lramp_e1_reasons" || e.elementKey === "lramp_e1_other")
    ),
    []
  )
}

// ---------------------------------------------------------------------------
// 5. E3 = Yes requires chain fields; comments optional
// ---------------------------------------------------------------------------

{
  const e3: FormAnswers = { ...validB1Yes(), lramp_e3: ["yes"] }
  const errors = validateAnswers(LRAMP_ELEMENTS, e3)
  const keys = new Set(errors.map((e) => e.elementKey))
  checkTrue("5a. requires vulnerability", keys.has("lramp_e3_vulnerability"))
  checkTrue("5b. requires prompting", keys.has("lramp_e3_prompting"))
  checkTrue(
    "5c. requires behaviour group",
    errors.some(
      (e) =>
        e.message === "Please answer at least one of these." &&
        (e.elementKey === "lramp_e3_behaviour" ||
          e.elementKey === "lramp_e3_behaviour_other")
    )
  )
  checkTrue("5d. requires consequences", keys.has("lramp_e3_consequences"))
  checkTrue("5e. comments not required", !keys.has("lramp_e3_comments"))

  e3.lramp_e3_vulnerability = ["sleep"]
  e3.lramp_e3_prompting = ["argument"]
  e3.lramp_e3_behaviour = ["suicide_threat"]
  e3.lramp_e3_consequences = ["relief"]
  check(
    "5f. E3 chain complete → no E3 errors",
    validateAnswers(LRAMP_ELEMENTS, e3).filter((e) =>
      e.elementKey.startsWith("lramp_e3")
    ),
    []
  )
}

// ---------------------------------------------------------------------------
// 6. E11.1 branching
// ---------------------------------------------------------------------------

{
  const noHosp: FormAnswers = {
    ...validB1Yes(),
    lramp_e11_1: ["no"],
  }
  delete noHosp.lramp_e11_2
  const visibleNo = visibleElementKeys(LRAMP_ELEMENTS, noHosp)
  checkTrue("6a. E11.1=No shows reasons", visibleNo.has("lramp_e11_1_reasons"))
  checkTrue("6b. E11.1=No hides E11.2", !visibleNo.has("lramp_e11_2"))
  checkTrue(
    "6c. E11.1=No without reason → group error",
    validateAnswers(LRAMP_ELEMENTS, noHosp).some(
      (e) =>
        e.message === "Please answer at least one of these." &&
        (e.elementKey === "lramp_e11_1_reasons" ||
          e.elementKey === "lramp_e11_1_other")
    )
  )

  const yesHosp: FormAnswers = {
    ...validB1Yes(),
    lramp_e11_1: ["yes"],
    lramp_e11_2: ["yes"],
  }
  const visibleYes = visibleElementKeys(LRAMP_ELEMENTS, yesHosp)
  checkTrue("6d. E11.1=Yes shows E11.2", visibleYes.has("lramp_e11_2"))
  checkTrue(
    "6e. E11.1=Yes hides not-recommended reasons",
    !visibleYes.has("lramp_e11_1_reasons")
  )
}

// ---------------------------------------------------------------------------
// 7. F1 = c → option C ticks/notes optional
// ---------------------------------------------------------------------------

{
  const f1c: FormAnswers = { ...validB1Yes(), lramp_f1: ["c"] }
  const visible = visibleElementKeys(LRAMP_ELEMENTS, f1c)
  checkTrue("7a. F1=c shows C actions", visible.has("lramp_f1_c_actions"))
  checkTrue("7b. F1=c shows C notes", visible.has("lramp_f1_c_notes"))
  checkTrue("7c. F1=c hides A reasons", !visible.has("lramp_f1_a_reasons"))
  check(
    "7d. F1=c C fields optional (no errors on them)",
    validateAnswers(LRAMP_ELEMENTS, f1c).filter((e) =>
      e.elementKey.startsWith("lramp_f1_c")
    ),
    []
  )
}

// ---------------------------------------------------------------------------
// 8. F2 requires tick or Other
// ---------------------------------------------------------------------------

{
  const noF2: FormAnswers = { ...validB1Yes() }
  delete noF2.lramp_f2
  checkTrue(
    "8a. F2 empty → at-least-one error",
    validateAnswers(LRAMP_ELEMENTS, noF2).some(
      (e) =>
        e.message === "Please answer at least one of these." &&
        (e.elementKey === "lramp_f2" || e.elementKey === "lramp_f2_other")
    )
  )

  noF2.lramp_f2_other = ["In one week"]
  check(
    "8b. F2 Other alone satisfies group",
    validateAnswers(LRAMP_ELEMENTS, noF2).filter(
      (e) =>
        e.message === "Please answer at least one of these." &&
        (e.elementKey === "lramp_f2" || e.elementKey === "lramp_f2_other")
    ),
    []
  )
}

// ---------------------------------------------------------------------------
// 10. Fully answered valid LRAMP on each path
// ---------------------------------------------------------------------------

{
  check(
    "10a. valid B1=Yes path → no errors",
    validateAnswers(LRAMP_ELEMENTS, validB1Yes()),
    []
  )
  check(
    "10b. valid B1=No path → no errors",
    validateAnswers(LRAMP_ELEMENTS, validB1No()),
    []
  )
}

check("element count is 98", LRAMP_ELEMENTS.length, 98)

// ---------------------------------------------------------------------------
// sectionStatuses + answersFromResponseRows
// ---------------------------------------------------------------------------

{
  const yesPath = sectionStatuses(LRAMP_ELEMENTS, validB1Yes())
  check(
    "sectionStatuses B1=Yes → no skipped C/D",
    yesPath.filter((s) => s.status === "skipped").map((s) => s.letter),
    []
  )
  check(
    "sectionStatuses B1=Yes fully answered → all done",
    yesPath.every((s) => s.status === "done"),
    true
  )

  const noPath = sectionStatuses(LRAMP_ELEMENTS, validB1No())
  check(
    "sectionStatuses B1=No → C and D skipped",
    noPath.filter((s) => s.status === "skipped").map((s) => s.letter),
    ["C", "D"]
  )
  check(
    "sectionStatuses B1=No fully answered → A/B/E/F done",
    noPath
      .filter((s) => ["A", "B", "E", "F"].includes(s.letter))
      .every((s) => s.status === "done"),
    true
  )

  const incompleteB = { ...validB1No() }
  delete incompleteB.lramp_b2
  const bStatuses = sectionStatuses(LRAMP_ELEMENTS, incompleteB)
  const sectionB = bStatuses.find((s) => s.letter === "B")
  check(
    "at-least-one group counts once in left",
    sectionB?.status === "left" && sectionB.left === 1,
    true
  )
}

{
  const rows = [
    { elementKey: "list", responseValue: "beta", responseOrder: 2 },
    { elementKey: "list", responseValue: "alpha", responseOrder: 1 },
    { elementKey: "single", responseValue: "yes", responseOrder: null },
  ]
  check("answersFromResponseRows orders by response_order", answersFromResponseRows(rows), {
    list: ["alpha", "beta"],
    single: ["yes"],
  })
}

console.log("All form-rules self-tests passed.")
