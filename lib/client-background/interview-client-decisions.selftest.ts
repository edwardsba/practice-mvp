import assert from "node:assert/strict"

import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import {
  emptyInterviewAnswers,
  prefillAnswersForReview,
  setItemAnswer,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"
import {
  acceptClientChangesAndConfirm,
  CLIENT_CHANGES_CHANGED_ERROR,
  decideClientField,
} from "@/lib/client-background/interview-client-decisions"
import {
  clientFieldStates,
  waitingClientFieldsForSection,
} from "@/lib/client-background/interview-client-fields"
import { emptyDemographics, emptyNecessities, type Demographics, type RelationshipRecord } from "@/lib/client-background/types"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const AT = "2026-11-28T00:00:00.000Z"
const suggestions: ClientBackgroundSuggestions = {
  identity: {
    sex: { label: "Male", apply: "Male" },
    pronouns: { label: "he/him", apply: "he/him" },
  },
  education: {},
  occupation: {
    necessities: { label: "Food", apply: { ...emptyNecessities(), food: true } },
  },
  living: {
    housingType: { label: "Private rental", apply: "Private rental" },
    livesWith: { label: "Partner", apply: { livesWith: "with_partner", livesWithOther: "" } },
  },
  history: {},
  medication: {},
  stressors: {},
}

const empty = emptyDemographics()
const file: Demographics = { ...empty, identity: { ...empty.identity, pronouns: "she/her" } }
const answers = emptyInterviewAnswers()

function waitingKeys(state: { answers: InterviewAnswersJson; demographics: Demographics }, section: number) {
  return waitingClientFieldsForSection(
    clientFieldStates(suggestions, state.demographics, state.answers.clientDecisions),
    section
  ).map((s) => s.fieldKey)
}

check("before deciding, section 3 waits on sex, pronouns, necessities", waitingKeys({ answers, demographics: file }, 3), [
  "identity.sex",
  "identity.pronouns",
  "occupation.necessities",
])

// --- Use client's / Keep ---

const used = decideClientField({ answers, demographics: file, suggestions, fieldKey: "identity.pronouns", choice: "used", at: AT })
assert.ok(used.ok)
check("Use writes the self-report value", used.demographics.identity.pronouns, "he/him")
check("Use records the decision", used.answers.clientDecisions["identity.pronouns"], { choice: "used", at: AT })
check("Use saves the identity section", used.changedSections, ["identity"])
check("Use stops that field waiting", waitingKeys(used, 3), ["identity.sex", "occupation.necessities"])

const kept = decideClientField({ answers, demographics: file, suggestions, fieldKey: "identity.pronouns", choice: "kept", at: AT })
assert.ok(kept.ok)
check("Keep leaves the file as it is", kept.demographics, file)
check("Keep saves nothing", kept.changedSections, [])
check("Keep records the decision", kept.answers.clientDecisions["identity.pronouns"], { choice: "kept", at: AT })
check("Keep stops that field waiting", waitingKeys(kept, 3), ["identity.sex", "occupation.necessities"])

const keptEmpty = decideClientField({ answers, demographics: file, suggestions, fieldKey: "identity.sex", choice: "kept", at: AT })
assert.ok(keptEmpty.ok)
check("Keep on an empty field leaves it empty", keptEmpty.demographics.identity.sex, "")

const onFile: Demographics = { ...file, identity: { ...file.identity, pronouns: "he/him" } }
const usedAgain = decideClientField({ answers, demographics: onFile, suggestions, fieldKey: "identity.pronouns", choice: "used", at: AT })
assert.ok(usedAgain.ok)
check("Use on an answer already on file writes nothing", usedAgain.changedSections, [])

check(
  "unknown field refused",
  decideClientField({ answers, demographics: file, suggestions, fieldKey: "identity.secret", choice: "used", at: AT }),
  { ok: false, error: "Unknown client answer." }
)
check(
  "unknown choice refused",
  decideClientField({ answers, demographics: file, suggestions, fieldKey: "identity.sex", choice: "maybe", at: AT }),
  { ok: false, error: "Choose Use client's or Keep." }
)
check(
  "field the client didn't answer refused",
  decideClientField({ answers, demographics: file, suggestions, fieldKey: "identity.religion", choice: "kept", at: AT }),
  { ok: false, error: "The client didn't answer this in the self-report." }
)
check(
  "a browser value is never used: only the field name is read",
  decideClientField({
    answers,
    demographics: file,
    suggestions,
    fieldKey: { fieldKey: "identity.pronouns", value: "xe/xem" },
    choice: "used",
    at: AT,
  }),
  { ok: false, error: "Unknown client answer." }
)

// --- Accept N client changes and confirm ---

const section3Answered = setItemAnswer(setItemAnswer(answers, "s3_disability", "no"), "s3_financial", "yes")

check(
  "accept refuses while a question is unanswered",
  acceptClientChangesAndConfirm({
    answers,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    detailHasValue: {},
    expectedFieldKeys: ["identity.sex", "identity.pronouns", "occupation.necessities"],
    at: AT,
  }),
  { ok: false, error: "Answer 2 questions first" }
)

const keptPronouns = decideClientField({
  answers: section3Answered,
  demographics: file,
  suggestions,
  fieldKey: "identity.pronouns",
  choice: "kept",
  at: AT,
})
assert.ok(keptPronouns.ok)
const accepted = acceptClientChangesAndConfirm({
  answers: keptPronouns.answers,
  demographics: file,
  suggestions,
  relationships: [],
  sectionNumber: 3,
  detailHasValue: { s3_identity: false, s3_education: false, s3_occupation: false },
  expectedFieldKeys: ["identity.sex", "occupation.necessities"],
  at: AT,
})
assert.ok(accepted.ok, accepted.ok ? "" : accepted.error)
check("accept applies only the waiting fields", accepted.appliedFieldKeys, ["identity.sex", "occupation.necessities"])
check("accept writes the self-report values", [accepted.demographics.identity.sex, accepted.demographics.occupation.necessities.food], [
  "Male",
  true,
])
check("accept leaves a kept field as it is", accepted.demographics.identity.pronouns, "she/her")
check("kept decision survives accept", accepted.answers.clientDecisions["identity.pronouns"]?.choice, "kept")
check("accepted fields recorded as used", [
  accepted.answers.clientDecisions["identity.sex"]?.choice,
  accepted.answers.clientDecisions["occupation.necessities"]?.choice,
], ["used", "used"])
check("accept saves identity and occupation", accepted.changedSections, ["identity", "occupation"])
check("accept confirms the section", accepted.answers.sections["3"], { confirmed: true, confirmedAt: AT })
check(
  "details re-checked against the record, not the browser",
  accepted.answers.items.s3_identity,
  { value: "confirmed", confirmed: true }
)
check("nothing waits after accept", waitingKeys(accepted, 3), [])

check(
  "accept refuses when the browser saw different waiting fields",
  acceptClientChangesAndConfirm({
    answers: section3Answered,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    detailHasValue: {},
    expectedFieldKeys: ["identity.sex"],
    at: AT,
  }),
  { ok: false, error: CLIENT_CHANGES_CHANGED_ERROR }
)
check(
  "accept refuses an extra field that isn't waiting",
  acceptClientChangesAndConfirm({
    answers: section3Answered,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    detailHasValue: {},
    expectedFieldKeys: ["identity.sex", "identity.pronouns", "occupation.necessities", "identity.religion"],
    at: AT,
  }),
  { ok: false, error: CLIENT_CHANGES_CHANGED_ERROR }
)
check(
  "accept refuses values from the browser",
  acceptClientChangesAndConfirm({
    answers: section3Answered,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    detailHasValue: {},
    expectedFieldKeys: [
      { fieldKey: "identity.sex", value: "Female" },
      "identity.pronouns",
      "occupation.necessities",
    ],
    at: AT,
  }),
  { ok: false, error: CLIENT_CHANGES_CHANGED_ERROR }
)
check(
  "accept only for sections with client answers",
  acceptClientChangesAndConfirm({
    answers,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 1,
    detailHasValue: {},
    expectedFieldKeys: [],
    at: AT,
  }),
  { ok: false, error: "Unknown interview section." }
)

// Section 7: no questions; household and housing type applied, details confirmed from the record.
const section7 = acceptClientChangesAndConfirm({
  answers,
  demographics: empty,
  suggestions,
  relationships: [] as RelationshipRecord[],
  sectionNumber: 7,
  detailHasValue: { s7_who: false, s7_housing_type: false, s7_housing_security: true },
  expectedFieldKeys: ["living.livesWith", "living.housingType"],
  at: AT,
})
assert.ok(section7.ok, section7.ok ? "" : section7.error)
check("section 7 accept writes household and housing type", [
  section7.demographics.livingSituation.household,
  section7.demographics.livingSituation.housingType,
], ["with_others", "Private rental"])
check("section 7 details follow the record", [
  section7.answers.items.s7_who,
  section7.answers.items.s7_housing_type,
  section7.answers.items.s7_housing_security,
], [
  { value: "confirmed", confirmed: true },
  { value: "confirmed", confirmed: true },
  { value: "not_applicable", confirmed: true },
])

// Review prefill (next interview) starts with no decisions.
check("review prefill omits client decisions", prefillAnswersForReview(accepted.answers).clientDecisions, {})

console.log("interview-client-decisions.selftest.ts: ok")
