import assert from "node:assert/strict"

import { emptyBackgroundAnswers } from "@/lib/background-questionnaire/answers"
import { backgroundAnswersToClientBackground } from "@/lib/background-questionnaire/to-client-background"
import { HOUSING_TYPE_OPTIONS, emptyNecessities } from "@/lib/client-background/types"
import type { BackgroundAnswers } from "@/lib/background-questionnaire/types"

function blank(): ClientBackgroundShape {
  return backgroundAnswersToClientBackground(emptyBackgroundAnswers())
}

type ClientBackgroundShape = ReturnType<typeof backgroundAnswersToClientBackground>

const empty = blank()
assert.deepEqual(empty, {
  identity: {},
  education: {},
  occupation: {},
  relationshipStatus: undefined,
  numberOfChildren: undefined,
  living: {},
  history: {},
  medication: {},
  stressors: {},
})

const skipped = emptyBackgroundAnswers()
skipped.aboutYou.religion = "   "
skipped.aboutYou.disability = null
skipped.aboutYou.pronouns = ""
skipped.familyHome.housingType = null
skipped.familyHome.housingSecurity = null
skipped.treatmentHistory.hospitalForEmotionalProblem = null
skipped.stressors.family = null
skipped.stressors.mainReason = " "
const skippedMapped = backgroundAnswersToClientBackground(skipped)
assert.deepEqual(skippedMapped.identity, {})
assert.deepEqual(skippedMapped.living, {})
assert.deepEqual(skippedMapped.history, {})
assert.deepEqual(skippedMapped.medication, {})
assert.deepEqual(skippedMapped.stressors, {})
assert.equal(skippedMapped.numberOfChildren, undefined)

const housing = emptyBackgroundAnswers()
housing.familyHome.housingType = "own_home"
housing.familyHome.housingSecurity = "secure"
const housingMapped = backgroundAnswersToClientBackground(housing)
assert.equal(housingMapped.living.housingType?.label, "Own home (owned or paying off)")
assert.equal(housingMapped.living.housingType?.apply, "Own home")
assert.ok(HOUSING_TYPE_OPTIONS.includes(housingMapped.living.housingType?.apply ?? ""))
assert.equal(housingMapped.living.housingStability?.label, "Secure")
assert.equal(housingMapped.living.housingStability?.apply, "Stable")

const concern = emptyBackgroundAnswers()
concern.familyHome.housingType = "parents_home"
concern.familyHome.housingSecurity = "some_concerns"
const concernMapped = backgroundAnswersToClientBackground(concern)
assert.equal(concernMapped.living.housingType?.apply, "Parent's home")
assert.equal(concernMapped.living.housingType?.label, "Parent's home")
assert.equal(concernMapped.living.housingStability?.label, "Some concerns")
assert.equal(concernMapped.living.housingStability?.apply, "Some concern")

const atRisk = emptyBackgroundAnswers()
atRisk.familyHome.housingType = "temporary_housing"
atRisk.familyHome.housingSecurity = "at_risk"
const atRiskMapped = backgroundAnswersToClientBackground(atRisk)
assert.equal(atRiskMapped.living.housingType?.apply, "Temporary housing")
assert.equal(atRiskMapped.living.housingStability?.label, "At risk")
assert.equal(atRiskMapped.living.housingStability?.apply, "Unstable")

const otherHousing = emptyBackgroundAnswers()
otherHousing.familyHome.housingType = "other"
otherHousing.familyHome.housingTypeOther = "Boarding house"
const otherHousingMapped = backgroundAnswersToClientBackground(otherHousing)
assert.equal(otherHousingMapped.living.housingType?.label, "Boarding house")
assert.equal(otherHousingMapped.living.housingType?.apply, "Other")

const pronouns = emptyBackgroundAnswers()
pronouns.aboutYou.pronouns = "ze/hir"
const pronounsMapped = backgroundAnswersToClientBackground(pronouns)
assert.deepEqual(pronounsMapped.identity.pronouns, { label: "ze/hir", apply: "ze/hir" })

const employed = emptyBackgroundAnswers()
employed.studyWork.workStatus = "full_time"
employed.studyWork.role = "Nurse"
employed.studyWork.employer = "City Hospital"
employed.studyWork.recentJobRole = "Old role"
employed.studyWork.recentJobEmployer = "Old employer"
const employedMapped = backgroundAnswersToClientBackground(employed)
assert.equal(employedMapped.occupation.workStatus?.apply.workStatus, "full_time")
assert.equal(employedMapped.occupation.workStatus?.label, "Full-time")
assert.deepEqual(employedMapped.occupation.role, { label: "Nurse", apply: "Nurse" })
assert.deepEqual(employedMapped.occupation.employer, { label: "City Hospital", apply: "City Hospital" })
assert.equal(employedMapped.occupation.previousJob, undefined)

const unemployed = emptyBackgroundAnswers()
unemployed.studyWork.workStatus = "unemployed"
unemployed.studyWork.role = "Should not apply"
unemployed.studyWork.employer = "Should not apply"
unemployed.studyWork.recentJobRole = "Teacher"
unemployed.studyWork.recentJobEmployer = "Primary school"
const unemployedMapped = backgroundAnswersToClientBackground(unemployed)
assert.equal(unemployedMapped.occupation.role, undefined)
assert.equal(unemployedMapped.occupation.employer, undefined)
assert.deepEqual(unemployedMapped.occupation.previousJob, {
  label: "Teacher · Primary school",
  apply: { role: "Teacher", employer: "Primary school" },
})

const necessities = emptyBackgroundAnswers()
necessities.studyWork.necessities = ["food", "phoneInternet"]
const necessitiesMapped = backgroundAnswersToClientBackground(necessities)
const expectedNecessities = emptyNecessities()
expectedNecessities.food = true
expectedNecessities.phoneInternet = true
assert.equal(necessitiesMapped.occupation.necessities?.label, "Food, Phone or internet")
assert.deepEqual(necessitiesMapped.occupation.necessities?.apply, expectedNecessities)

const history = emptyBackgroundAnswers()
history.treatmentHistory.hospitalForEmotionalProblem = true
history.treatmentHistory.therapyForEmotionalIssues = false
history.treatmentHistory.currentMedication = false
history.treatmentHistory.everTakenMedication = true
history.treatmentHistory.familyEmotionalProblem = true
history.treatmentHistory.familyAlcoholOrDrugs = false
history.treatmentHistory.familyHospitalForEmotionalOrSubstance = true
history.stressors.family = true
history.stressors.socialLife = false
history.stressors.intimateRelationships = true
history.stressors.workOrStudy = false
history.stressors.financial = true
history.stressors.yourHealth = false
history.stressors.healthOfSignificantOthers = true
history.stressors.lossOfLovedOne = false
history.stressors.legalMatters = true
history.stressors.mainReason = "Anxiety at work"
history.familyHome.numberOfChildren = 0
const historyMapped = backgroundAnswersToClientBackground(history)
assert.deepEqual(historyMapped.history.psychiatric_admission, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.history.previous_therapy, { label: "No", apply: "no" })
assert.deepEqual(Object.keys(historyMapped.history).sort(), [
  "family_emotional_problems",
  "family_psychiatric_admission",
  "family_substance_use",
  "previous_therapy",
  "psychiatric_admission",
])
assert.deepEqual(historyMapped.medication.currentlyTaking, { label: "No", apply: "no" })
assert.deepEqual(historyMapped.medication.previouslyTaken, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.history.family_emotional_problems, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.history.family_substance_use, { label: "No", apply: "no" })
assert.deepEqual(historyMapped.history.family_psychiatric_admission, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.stressors.family, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.stressors.socialLife, { label: "No", apply: "no" })
assert.deepEqual(historyMapped.stressors.intimateRelationships, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.stressors.workStudy, { label: "No", apply: "no" })
assert.deepEqual(historyMapped.stressors.financial, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.stressors.ownHealth, { label: "No", apply: "no" })
assert.deepEqual(historyMapped.stressors.othersHealth, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.stressors.lossOfLovedOne, { label: "No", apply: "no" })
assert.deepEqual(historyMapped.stressors.legalPoliceAccidents, { label: "Yes", apply: "yes" })
assert.deepEqual(historyMapped.stressors.mainReason, { label: "Anxiety at work", apply: "Anxiety at work" })
assert.deepEqual(historyMapped.numberOfChildren, { label: "no children", count: 0 })
assert.equal("apply" in (historyMapped.numberOfChildren ?? {}), false)

const oneChild = emptyBackgroundAnswers()
oneChild.familyHome.numberOfChildren = 1
assert.equal(backgroundAnswersToClientBackground(oneChild).numberOfChildren?.label, "1 child")
const three = emptyBackgroundAnswers()
three.familyHome.numberOfChildren = 3
assert.equal(
  backgroundAnswersToClientBackground(three).numberOfChildren?.label,
  "3 children (including step-children)"
)

function keysOf(value: BackgroundAnswers) {
  return backgroundAnswersToClientBackground(value)
}
assert.equal(keysOf(emptyBackgroundAnswers()).occupation.previousJob, undefined)

console.log("background questionnaire to client background selftest passed")
