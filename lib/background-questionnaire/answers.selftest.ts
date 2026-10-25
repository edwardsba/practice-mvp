import assert from "node:assert/strict"

import { sanitizeBackgroundAnswers, emptyBackgroundAnswers } from "@/lib/background-questionnaire/answers"
import {
  BACKGROUND_PARTS,
  educationChoicesUseKnownLevels,
  housingChoicesCoverKnownValues,
} from "@/lib/background-questionnaire/questions"
import {
  EDUCATION_LEVEL_OPTIONS,
  SEX_OPTIONS,
  WORK_STATUSES,
  CLIENT_RELATIONSHIP_STATUSES,
  LIVES_WITH_OPTIONS,
  NECESSITY_KEYS,
} from "@/lib/client-background/types"
import type { BackgroundAnswers } from "@/lib/background-questionnaire/types"

const withGender = sanitizeBackgroundAnswers({
  aboutYou: { genderIdentity: "  non-binary ", pronouns: " they/them " },
})
assert.equal(withGender.aboutYou.genderIdentity, "non-binary")
assert.equal(withGender.aboutYou.pronouns, "they/them")

const withoutGender = sanitizeBackgroundAnswers({
  aboutYou: { genderIdentity: "   ", pronouns: "they/them" },
})
assert.equal(withoutGender.aboutYou.genderIdentity, "")
assert.equal(withoutGender.aboutYou.pronouns, "")

const disabilityNo = sanitizeBackgroundAnswers({
  aboutYou: { disability: false, disabilityDetail: "asthma" },
})
assert.equal(disabilityNo.aboutYou.disability, false)
assert.equal(disabilityNo.aboutYou.disabilityDetail, "")

const disabilityYes = sanitizeBackgroundAnswers({
  aboutYou: { disability: true, disabilityDetail: "  Low vision  " },
})
assert.equal(disabilityYes.aboutYou.disabilityDetail, "Low vision")

const takingNow = sanitizeBackgroundAnswers({
  treatmentHistory: { currentMedication: true, everTakenMedication: false },
})
assert.equal(takingNow.treatmentHistory.currentMedication, true)
assert.equal(takingNow.treatmentHistory.everTakenMedication, null)

const notTaking = sanitizeBackgroundAnswers({
  treatmentHistory: { currentMedication: false, everTakenMedication: true },
})
assert.equal(notTaking.treatmentHistory.currentMedication, false)
assert.equal(notTaking.treatmentHistory.everTakenMedication, true)

for (const status of ["full_time", "part_time", "casual", "self_employed"] as const) {
  const employed = sanitizeBackgroundAnswers({
    studyWork: {
      workStatus: status,
      role: "Nurse",
      employer: "City Hospital",
      recentJobRole: "Clerk",
      recentJobEmployer: "Corner Shop",
      workStatusOther: "Something else",
    },
  })
  assert.equal(employed.studyWork.workStatus, status)
  assert.equal(employed.studyWork.role, "Nurse")
  assert.equal(employed.studyWork.employer, "City Hospital")
  assert.equal(employed.studyWork.recentJobRole, "")
  assert.equal(employed.studyWork.recentJobEmployer, "")
  assert.equal(employed.studyWork.workStatusOther, "")
}

const unemployed = sanitizeBackgroundAnswers({
  studyWork: {
    workStatus: "unemployed",
    role: "Nurse",
    employer: "City Hospital",
    recentJobRole: "Clerk",
    recentJobEmployer: "Corner Shop",
  },
})
assert.equal(unemployed.studyWork.role, "")
assert.equal(unemployed.studyWork.employer, "")
assert.equal(unemployed.studyWork.recentJobRole, "Clerk")
assert.equal(unemployed.studyWork.recentJobEmployer, "Corner Shop")

const unknown = sanitizeBackgroundAnswers({
  aboutYou: { sex: "Robot" },
  studyWork: { workStatus: "king", level: "PhD", necessities: ["food", "rent", "food"] },
  familyHome: { housingType: "mansion", livesWith: "with_a_dragon" },
})
assert.equal(unknown.aboutYou.sex, null)
assert.equal(unknown.studyWork.workStatus, null)
assert.equal(unknown.studyWork.level, null)
assert.deepEqual(unknown.studyWork.necessities, ["food"])
assert.equal(unknown.familyHome.housingType, null)
assert.equal(unknown.familyHome.livesWith, null)

assert.equal(
  sanitizeBackgroundAnswers({ familyHome: { numberOfChildren: 25 } }).familyHome
    .numberOfChildren,
  20
)
assert.equal(
  sanitizeBackgroundAnswers({ familyHome: { numberOfChildren: -1 } }).familyHome
    .numberOfChildren,
  0
)
assert.equal(
  sanitizeBackgroundAnswers({ familyHome: { numberOfChildren: 0 } }).familyHome
    .numberOfChildren,
  0
)

const notOther = sanitizeBackgroundAnswers({
  studyWork: { workStatus: "retired", workStatusOther: "Between jobs" },
  familyHome: {
    relationshipStatus: "single",
    relationshipStatusOther: "It's complicated",
    housingType: "private_rental",
    housingTypeOther: "Granny flat",
  },
})
assert.equal(notOther.studyWork.workStatusOther, "")
assert.equal(notOther.familyHome.relationshipStatusOther, "")
assert.equal(notOther.familyHome.housingTypeOther, "")

const bachelor = sanitizeBackgroundAnswers({
  studyWork: { level: "Bachelor degree", fieldOfStudy: "Psychology" },
})
assert.equal(bachelor.studyWork.fieldOfStudy, "Psychology")

const secondary = sanitizeBackgroundAnswers({
  studyWork: { level: "Secondary", fieldOfStudy: "Psychology" },
})
assert.equal(secondary.studyWork.fieldOfStudy, "")

function assertEmptyShape(value: BackgroundAnswers) {
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      assert.deepEqual(node, [])
      return
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        if (key === "version") {
          assert.equal(child, 1)
          continue
        }
        walk(child)
      }
      return
    }
    assert.ok(node === null || node === "", `unexpected ${String(node)}`)
  }
  walk(value)
}

for (const input of [undefined, null, {}, "nope", [], { aboutYou: null }]) {
  const empty = sanitizeBackgroundAnswers(input)
  assert.equal(empty.version, 1)
  assertEmptyShape(empty)
}

const empty = emptyBackgroundAnswers()
for (const part of BACKGROUND_PARTS) {
  const section = empty[part.key] as Record<string, unknown>
  for (const question of part.questions) {
    assert.ok(question.field in section, question.field)
    for (const conditional of question.conditionals ?? []) {
      assert.ok(conditional.field in section, conditional.field)
    }
  }
}

assert.equal(BACKGROUND_PARTS.length, 5)
assert.equal(educationChoicesUseKnownLevels(), true)
assert.equal(housingChoicesCoverKnownValues(), true)

const levelQuestion = BACKGROUND_PARTS.find((part) => part.key === "studyWork")?.questions.find(
  (question) => question.field === "level"
)
for (const option of levelQuestion?.options ?? []) {
  assert.ok(
    (EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(option.value),
    option.value
  )
}

const sexQuestion = BACKGROUND_PARTS[0]?.questions.find((question) => question.field === "sex")
assert.deepEqual(
  sexQuestion?.options?.map((option) => option.value),
  [...SEX_OPTIONS]
)

const workQuestion = BACKGROUND_PARTS.find((part) => part.key === "studyWork")?.questions.find(
  (question) => question.field === "workStatus"
)
assert.deepEqual(
  workQuestion?.options?.map((option) => option.value),
  [...WORK_STATUSES]
)

const relationshipQuestion = BACKGROUND_PARTS.find(
  (part) => part.key === "familyHome"
)?.questions.find((question) => question.field === "relationshipStatus")
for (const option of relationshipQuestion?.options ?? []) {
  assert.ok(
    (CLIENT_RELATIONSHIP_STATUSES as readonly string[]).includes(option.value),
    option.value
  )
}

const livesWithQuestion = BACKGROUND_PARTS.find((part) => part.key === "familyHome")?.questions.find(
  (question) => question.field === "livesWith"
)
assert.deepEqual(
  livesWithQuestion?.options?.map((option) => option.value),
  [...LIVES_WITH_OPTIONS]
)

const necessityQuestion = BACKGROUND_PARTS.find((part) => part.key === "studyWork")?.questions.find(
  (question) => question.field === "necessities"
)
assert.deepEqual(
  necessityQuestion?.options?.map((option) => option.value),
  [...NECESSITY_KEYS]
)

console.log("background questionnaire answers selftest passed")
