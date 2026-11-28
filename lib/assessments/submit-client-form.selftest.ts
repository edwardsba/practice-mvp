/**
 * Pure parts of the shared-form client submit path.
 */

import assert from "node:assert/strict"

import { BACKGROUND_SR_ELEMENTS } from "@/lib/assessments/definitions/background-sr"
import {
  IN_PERSON_VALUE,
  serializeHistoryListEntry,
  serializePersonListEntry,
} from "@/lib/assessments/form-lists"
import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"
import { definitionUsesSharedClientForm } from "@/lib/assessments/needs-shared-client-form"
import { prepareClientFormSubmission } from "@/lib/assessments/submit-client-form"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function checkTrue(name: string, value: boolean) {
  assert.equal(value, true, name)
  console.log(`ok — ${name}`)
}

checkTrue(
  "BACKGROUND_SR uses shared client form",
  definitionUsesSharedClientForm(BACKGROUND_SR_ELEMENTS)
)

const radioOnly: FormElement[] = [
  {
    elementKey: "q1",
    elementType: "radio",
    questionText: "Q1",
    groupLabel: null,
    subgroupLabel: null,
    displayOrder: 1,
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
]
check(
  "radio-only definition stays on legacy path",
  definitionUsesSharedClientForm(radioOnly),
  false
)

// --- unknown keys dropped ---
const withUnknown: FormAnswers = {
  sex: ["Male"],
  not_a_real_key: ["hacker"],
  another_fake: ["x"],
}
const unknownPrepared = prepareClientFormSubmission(
  BACKGROUND_SR_ELEMENTS,
  withUnknown
)
checkTrue("unknown keys: prepare ok", unknownPrepared.ok)
if (unknownPrepared.ok) {
  check(
    "unknown keys dropped from cleaned answers",
    Object.keys(unknownPrepared.answers).sort(),
    ["sex"]
  )
  check(
    "unknown keys not in response rows",
    unknownPrepared.rows.map((r) => r.elementKey),
    ["sex"]
  )
}

// --- invalid option refused ---
const invalidOption: FormAnswers = {
  sex: ["not-a-valid-sex"],
}
const invalidPrepared = prepareClientFormSubmission(
  BACKGROUND_SR_ELEMENTS,
  invalidOption
)
check("invalid option refused", invalidPrepared.ok, false)
if (!invalidPrepared.ok) {
  checkTrue(
    "invalid option names the field",
    invalidPrepared.errors.some((e) => e.elementKey === "sex")
  )
}

// --- list entries cleaned ---
const partnerConfig =
  BACKGROUND_SR_ELEMENTS.find((el) => el.elementKey === "partner")?.listConfig ??
  null
const blankPerson = serializePersonListEntry({})
const goodPerson = serializePersonListEntry({
  firstName: "Sam",
  fromYear: 2018,
})
const listAnswers: FormAnswers = {
  relationship_status: ["married"],
  partner: [blankPerson, goodPerson, "   ", "{}"],
  hist_physical: ["yes"],
  hist_physical_list: [
    serializeHistoryListEntry({}),
    serializeHistoryListEntry({ what: "Car accident", when: "2019" }),
  ],
}
const listPrepared = prepareClientFormSubmission(
  BACKGROUND_SR_ELEMENTS,
  listAnswers
)
checkTrue("list entries: prepare ok", listPrepared.ok)
if (listPrepared.ok) {
  const partnerRows = listPrepared.rows.filter((r) => r.elementKey === "partner")
  check("blank person_list entries dropped", partnerRows.length, 1)
  check(
    "kept person_list firstName",
    JSON.parse(partnerRows[0]!.responseValue).firstName,
    "Sam"
  )
  check(
    "person_list responseOrder starts at 1",
    partnerRows[0]!.responseOrder,
    1
  )
  const histRows = listPrepared.rows.filter(
    (r) => r.elementKey === "hist_physical_list"
  )
  check("blank history_list entries dropped", histRows.length, 1)
  check(
    "kept history what",
    JSON.parse(histRows[0]!.responseValue).what,
    "Car accident"
  )
  void partnerConfig
}

// --- in_person accepted ---
const inPersonAnswers: FormAnswers = {
  hist_substance: [IN_PERSON_VALUE],
}
const inPersonPrepared = prepareClientFormSubmission(
  BACKGROUND_SR_ELEMENTS,
  inPersonAnswers
)
checkTrue("in_person: prepare ok", inPersonPrepared.ok)
if (inPersonPrepared.ok) {
  check(
    "in_person stored",
    inPersonPrepared.rows.find((r) => r.elementKey === "hist_substance"),
    {
      elementKey: "hist_substance",
      responseValue: IN_PERSON_VALUE,
      responseOrder: null,
      scoreValue: 0,
    }
  )
}

console.log("\nsubmit-client-form.selftest.ts: ok")
