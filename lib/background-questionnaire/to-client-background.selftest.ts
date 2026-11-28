import assert from "node:assert/strict"

import { emptyBackgroundSelfReportV2 } from "@/lib/background-questionnaire/parse"
import {
  backgroundSelfReportToClientBackground,
  formatWhoLivesWithClientLabel,
} from "@/lib/background-questionnaire/to-client-background"
import { HOUSING_TYPE_OPTIONS, emptyNecessities } from "@/lib/client-background/types"
import type { BackgroundSelfReportV2 } from "@/lib/background-questionnaire/types"

function blank() {
  return backgroundSelfReportToClientBackground(emptyBackgroundSelfReportV2())
}

const empty = blank()
assert.deepEqual(empty, {
  identity: {},
  education: {},
  occupation: {},
  living: {},
})

const skipped = emptyBackgroundSelfReportV2()
skipped.religion = "   "
skipped.disability = null
skipped.pronouns = "they/them"
skipped.genderDiffers = "no"
skipped.housingType = null
skipped.housingSecurity = null
const skippedMapped = backgroundSelfReportToClientBackground(skipped)
assert.deepEqual(skippedMapped.identity, {})
assert.deepEqual(skippedMapped.living, {})

const housing = emptyBackgroundSelfReportV2()
housing.housingType = "Own home"
housing.housingSecurity = "Stable"
const housingMapped = backgroundSelfReportToClientBackground(housing)
assert.equal(housingMapped.living.housingType?.label, "Own home")
assert.equal(housingMapped.living.housingType?.apply, "Own home")
assert.ok(HOUSING_TYPE_OPTIONS.includes(housingMapped.living.housingType?.apply ?? ""))
assert.equal(housingMapped.living.housingStability?.label, "Stable")
assert.equal(housingMapped.living.housingStability?.apply, "Stable")

const concern = emptyBackgroundSelfReportV2()
concern.housingType = "Parent's home"
concern.housingSecurity = "Some concern"
const concernMapped = backgroundSelfReportToClientBackground(concern)
assert.equal(concernMapped.living.housingType?.apply, "Parent's home")
assert.equal(concernMapped.living.housingStability?.apply, "Some concern")

const atRisk = emptyBackgroundSelfReportV2()
atRisk.housingType = "Temporary housing"
atRisk.housingSecurity = "Unstable"
const atRiskMapped = backgroundSelfReportToClientBackground(atRisk)
assert.equal(atRiskMapped.living.housingType?.apply, "Temporary housing")
assert.equal(atRiskMapped.living.housingStability?.apply, "Unstable")

const gender = emptyBackgroundSelfReportV2()
gender.genderDiffers = "yes"
gender.genderIdentity = "non-binary"
gender.pronouns = "ze/hir"
const genderMapped = backgroundSelfReportToClientBackground(gender)
assert.deepEqual(genderMapped.identity.genderIdentity, { label: "non-binary", apply: "non-binary" })
assert.deepEqual(genderMapped.identity.pronouns, { label: "ze/hir", apply: "ze/hir" })

const genderNo = emptyBackgroundSelfReportV2()
genderNo.genderDiffers = "no"
genderNo.genderIdentity = "should not show"
genderNo.pronouns = "should not show"
assert.equal(backgroundSelfReportToClientBackground(genderNo).identity.genderIdentity, undefined)
assert.equal(backgroundSelfReportToClientBackground(genderNo).identity.pronouns, undefined)

const access = emptyBackgroundSelfReportV2()
access.accessNeeds = "Auslan interpreter"
assert.deepEqual(backgroundSelfReportToClientBackground(access).identity.accessibilityNeeds, {
  label: "Auslan interpreter",
  apply: "Auslan interpreter",
})

const employed = emptyBackgroundSelfReportV2()
employed.workStatus = "full_time"
employed.jobRole = "Nurse"
employed.employer = "City Hospital"
employed.recentJob = "Old role"
const employedMapped = backgroundSelfReportToClientBackground(employed)
assert.equal(employedMapped.occupation.workStatus?.apply.workStatus, "full_time")
assert.equal(employedMapped.occupation.workStatus?.label, "Full-time")
assert.deepEqual(employedMapped.occupation.role, { label: "Nurse", apply: "Nurse" })
assert.deepEqual(employedMapped.occupation.employer, { label: "City Hospital", apply: "City Hospital" })
assert.equal(employedMapped.occupation.previousJob, undefined)

const unemployed = emptyBackgroundSelfReportV2()
unemployed.workStatus = "unemployed"
unemployed.jobRole = "Should not apply"
unemployed.employer = "Should not apply"
unemployed.recentJob = "Teacher"
const unemployedMapped = backgroundSelfReportToClientBackground(unemployed)
assert.equal(unemployedMapped.occupation.role, undefined)
assert.equal(unemployedMapped.occupation.employer, undefined)
assert.deepEqual(unemployedMapped.occupation.previousJob, {
  label: "Teacher",
  apply: { role: "Teacher", employer: "" },
})

const unable = emptyBackgroundSelfReportV2()
unable.workStatus = "unable_to_work"
unable.recentJob = "Driver"
assert.deepEqual(backgroundSelfReportToClientBackground(unable).occupation.previousJob, {
  label: "Driver",
  apply: { role: "Driver", employer: "" },
})

const necessities = emptyBackgroundSelfReportV2()
necessities.hardToAfford = ["food", "phoneInternet"]
const necessitiesMapped = backgroundSelfReportToClientBackground(necessities)
const expectedNecessities = emptyNecessities()
expectedNecessities.food = true
expectedNecessities.phoneInternet = true
assert.equal(necessitiesMapped.occupation.necessities?.label, "Food, Phone or internet")
assert.deepEqual(necessitiesMapped.occupation.necessities?.apply, expectedNecessities)

const who = formatWhoLivesWithClientLabel(
  ["partner", "children", "flatmates_friends"],
  "2 flatmates"
)
assert.equal(who, "a partner, children, flatmates or friends (2 flatmates)")

const whoMapped = emptyBackgroundSelfReportV2()
whoMapped.livesWith = ["partner", "children", "flatmates_friends"]
whoMapped.livesWithOthers = "2 flatmates"
assert.equal(
  backgroundSelfReportToClientBackground(whoMapped).living.whoLivesWithLabel,
  "a partner, children, flatmates or friends (2 flatmates)"
)

const alone = emptyBackgroundSelfReportV2()
alone.livesWith = ["alone"]
assert.equal(backgroundSelfReportToClientBackground(alone).living.whoLivesWithLabel, "I live alone")

// Sections 5/6/8/9 are not mapped yet — relationship/history stay off the suggestions object.
const withLists: BackgroundSelfReportV2 = emptyBackgroundSelfReportV2()
withLists.relationshipStatus = "married"
withLists.partner = [{ firstName: "Alex" }]
withLists.histMental = "yes"
withLists.famSubstance = "no"
const listsMapped = backgroundSelfReportToClientBackground(withLists)
assert.equal("relationshipStatus" in listsMapped, false)
assert.equal("history" in listsMapped, false)
assert.equal("medication" in listsMapped, false)
assert.equal("stressors" in listsMapped, false)
assert.equal("numberOfChildren" in listsMapped, false)

// Sexual orientation is never suggested.
const noOrientation = emptyBackgroundSelfReportV2()
noOrientation.sex = "Female"
assert.equal(
  backgroundSelfReportToClientBackground(noOrientation).identity.sexualOrientation,
  undefined
)

console.log("background questionnaire to client background selftest passed")
