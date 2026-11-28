/**
 * End-to-end (pure): shared-form answers → toResponseRows → BACKGROUND_SR parse →
 * interview sections 3 and 7 client lines.
 * Mirrors what loadLatestBackgroundSelfReport + interview see after submit-form.
 */

import assert from "node:assert/strict"

import { BACKGROUND_SR_ELEMENTS } from "@/lib/assessments/definitions/background-sr"
import {
  IN_PERSON_VALUE,
  serializePersonListEntry,
} from "@/lib/assessments/form-lists"
import type { FormAnswers } from "@/lib/assessments/form-rules"
import { prepareClientFormSubmission } from "@/lib/assessments/submit-client-form"
import { backgroundSelfReportToClientBackground } from "@/lib/background-questionnaire/to-client-background"
import {
  hasBackgroundSelfReportV2Rows,
  parseBackgroundSelfReport,
} from "@/lib/background-questionnaire/parse"
import {
  clientFieldStates,
  waitingClientFieldsForSection,
} from "@/lib/client-background/interview-client-fields"
import { emptyDemographics } from "@/lib/client-background/types"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function checkTrue(name: string, value: boolean) {
  assert.equal(value, true, name)
  console.log(`ok — ${name}`)
}

const answers: FormAnswers = {
  sex: ["Female"],
  gender_differs: ["yes"],
  gender_identity: ["non-binary"],
  pronouns: ["they/them"],
  cultural_background: ["Australian"],
  religion: ["None"],
  language: ["English"],
  disability: ["no"],
  education_level: ["Bachelor degree"],
  field_of_study: ["Psychology"],
  currently_studying: ["no"],
  work_status: ["full_time"],
  job_role: ["Psychologist"],
  employer: ["Clinic"],
  hard_to_afford: ["food", "phoneInternet"],
  relationship_status: ["married"],
  partner: [
    serializePersonListEntry({
      firstName: "Alex",
      fromYear: 2015,
    }),
  ],
  housing_type: ["Own home"],
  housing_security: ["Stable"],
  lives_with: ["partner", "children"],
  // in_person on a sensitive history item — should still parse as v2
  hist_substance: [IN_PERSON_VALUE],
  hist_physical: ["no"],
}

const prepared = prepareClientFormSubmission(BACKGROUND_SR_ELEMENTS, answers)
checkTrue("submit prepare ok", prepared.ok)
if (!prepared.ok) {
  throw new Error(`prepare failed: ${JSON.stringify(prepared.errors)}`)
}

checkTrue(
  "rows look like v2 to the loader",
  hasBackgroundSelfReportV2Rows(prepared.rows)
)

const { report, droppedUnknownKeys } = parseBackgroundSelfReport(prepared.rows)
check("no unknown keys from toResponseRows", droppedUnknownKeys, [])
check("sex parsed", report.sex, "Female")
check("pronouns parsed", report.pronouns, "they/them")
check("gender identity parsed", report.genderIdentity, "non-binary")
check("work status parsed", report.workStatus, "full_time")
check("housing type parsed", report.housingType, "Own home")
check("housing security parsed", report.housingSecurity, "Stable")
check("partner name parsed", report.partner[0]?.firstName, "Alex")
check("lives_with parsed", report.livesWith, ["partner", "children"])
check("hard_to_afford parsed", report.hardToAfford, ["food", "phoneInternet"])
check("hist_substance in_person parsed", report.histSubstance, IN_PERSON_VALUE)

const suggestions = backgroundSelfReportToClientBackground(report)
check("suggestion sex", suggestions.identity.sex?.apply, "Female")
check("suggestion pronouns", suggestions.identity.pronouns?.apply, "they/them")
check(
  "suggestion gender",
  suggestions.identity.genderIdentity?.apply,
  "non-binary"
)
check(
  "suggestion work",
  suggestions.occupation.workStatus?.apply.workStatus,
  "full_time"
)
check("suggestion housing", suggestions.living.housingType?.apply, "Own home")

const states = clientFieldStates(suggestions, emptyDemographics(), {})
const section3Waiting = waitingClientFieldsForSection(states, 3)
const section7Waiting = waitingClientFieldsForSection(states, 7)

checkTrue(
  "section 3 shows client lines waiting",
  section3Waiting.some((s) => s.fieldKey === "identity.sex" && s.waiting)
)
checkTrue(
  "section 3 pronouns waiting",
  section3Waiting.some((s) => s.fieldKey === "identity.pronouns" && s.waiting)
)
checkTrue(
  "section 7 housing waiting",
  section7Waiting.some((s) => s.fieldKey === "living.housingType" && s.waiting)
)

const sexState = states.find((s) => s.fieldKey === "identity.sex")
check("Client: sex label", sexState?.label, "Female")

console.log("\nclient-form-interview-path.selftest.ts: ok")
