import assert from "node:assert/strict"

import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import {
  emptyInterviewAnswers,
  prefillAnswersForReview,
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
import type { InterviewConfirmFile } from "@/lib/client-background/interview-confirm-presence"
import { emptyDemographics, emptyNecessities, type Demographics, type RelationshipRecord } from "@/lib/client-background/types"

const emptyComms = {
  commsOptOut: false,
  reminderOptOut: false,
  preSessionOptOut: false,
  postSessionOptOut: false,
  adminCommsOptOut: false,
  onlineBookingPermitted: false,
}

/** Confirm file without demographics/relationships (those come from the accept path). */
const emptyConfirmFile: Omit<InterviewConfirmFile, "demographics" | "relationships"> = {
  clientDisplayName: "Test",
  preferredName: null,
  dateOfBirth: null,
  ageLabel: "",
  phone: null,
  email: null,
  address: null,
  comms: emptyComms,
  blocks: [],
  emergencyContacts: [],
  medicalContacts: [],
  claimTypeCodes: [],
}

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
    whoLivesWithLabel: "a partner",
  },
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
// Section 3 has no questions (disability / financial are presence details).

check(
  "section 3 accept is not blocked by unanswered questions",
  acceptClientChangesAndConfirm({
    answers,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    confirmFile: emptyConfirmFile,
    expectedFieldKeys: ["identity.sex"],
    at: AT,
  }),
  { ok: false, error: CLIENT_CHANGES_CHANGED_ERROR }
)

const keptPronouns = decideClientField({
  answers,
  demographics: file,
  suggestions,
  fieldKey: "identity.pronouns",
  choice: "kept",
  at: AT,
})
assert.ok(keptPronouns.ok)
const fileWithDisability: Demographics = {
  ...file,
  identity: { ...file.identity, disability: true, disabilityDetail: "Hearing" },
}
const accepted = acceptClientChangesAndConfirm({
  answers: keptPronouns.answers,
  demographics: fileWithDisability,
  suggestions,
  relationships: [],
  sectionNumber: 3,
  confirmFile: emptyConfirmFile,
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
check("presence disability → yes from stored data", accepted.answers.items.s3_disability, {
  value: "yes",
  confirmed: true,
})
check("presence financial → yes when hard-to-afford applies financial hardship", accepted.answers.items.s3_financial, {
  value: "yes",
  confirmed: true,
})
check("accept necessities sets financial hardship", accepted.demographics.occupation.financialConcerns, true)
check("nothing waits after accept", waitingKeys(accepted, 3), [])

check(
  "accept refuses when the browser saw different waiting fields",
  acceptClientChangesAndConfirm({
    answers,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    confirmFile: emptyConfirmFile,
    expectedFieldKeys: ["identity.sex"],
    at: AT,
  }),
  { ok: false, error: CLIENT_CHANGES_CHANGED_ERROR }
)
check(
  "accept refuses an extra field that isn't waiting",
  acceptClientChangesAndConfirm({
    answers,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    confirmFile: emptyConfirmFile,
    expectedFieldKeys: ["identity.sex", "identity.pronouns", "occupation.necessities", "identity.religion"],
    at: AT,
  }),
  { ok: false, error: CLIENT_CHANGES_CHANGED_ERROR }
)
check(
  "accept refuses values from the browser",
  acceptClientChangesAndConfirm({
    answers,
    demographics: file,
    suggestions,
    relationships: [],
    sectionNumber: 3,
    confirmFile: emptyConfirmFile,
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
    confirmFile: emptyConfirmFile,
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
  confirmFile: emptyConfirmFile,
  expectedFieldKeys: ["living.housingType"],
  at: AT,
})
assert.ok(section7.ok, section7.ok ? "" : section7.error)
check("section 7 accept writes housing type", [
  section7.demographics.livingSituation.housingType,
], ["Private rental"])
check("section 7 details follow the record", [
  section7.answers.items.s7_who,
  section7.answers.items.s7_housing_type,
  section7.answers.items.s7_housing_security,
], [
  // who-lives-with is display-only from the self-report; household stays empty → n/a
  { value: "not_applicable", confirmed: true },
  { value: "confirmed", confirmed: true },
  { value: "not_applicable", confirmed: true },
])

// Review prefill (next interview) starts with no decisions.
check("review prefill omits client decisions", prefillAnswersForReview(accepted.answers).clientDecisions, {})

console.log("interview-client-decisions.selftest.ts: ok")
