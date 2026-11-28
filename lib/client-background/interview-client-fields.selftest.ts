import assert from "node:assert/strict"

import {
  acceptClientChangesButtonLabel,
  applyClientField,
  clientFieldDisplayLabel,
  clientFieldStates,
  clientFieldStatesForItem,
  compareClientField,
  waitingClientFields,
  waitingClientFieldsForSection,
  type ClientFieldKey,
} from "@/lib/client-background/interview-client-fields"
import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import { emptyDemographics, emptyNecessities, type Demographics } from "@/lib/client-background/types"
import {
  emptyInterviewAnswers,
  prefillAnswersForReview,
  sanitizeInterviewAnswers,
  setClientDecision,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const emptyDemo = emptyDemographics()
const suggestions: ClientBackgroundSuggestions = {
  identity: {
    pronouns: { label: "he/him", apply: "he/him" },
    sex: { label: "Male", apply: "Male" },
  },
  education: {},
  occupation: {
    necessities: {
      label: "Food, Phone",
      apply: { ...emptyNecessities(), food: true, phoneInternet: true },
    },
  },
  living: {
    housingType: { label: "Own home", apply: "Own home" },
  },
  history: {},
  medication: {},
  stressors: {},
}

check(
  "no client answer → null",
  compareClientField("identity.religion", suggestions, emptyDemo),
  null
)
check(
  "file empty → empty",
  compareClientField("identity.pronouns", suggestions, emptyDemo),
  { label: "he/him", kind: "empty" }
)

const withPronouns = {
  ...emptyDemo,
  identity: { ...emptyDemo.identity, pronouns: "he/him" },
}
check(
  "same as file → same",
  compareClientField("identity.pronouns", suggestions, withPronouns),
  { label: "he/him", kind: "same" }
)

const differentPronouns = {
  ...emptyDemo,
  identity: { ...emptyDemo.identity, pronouns: "she/her" },
}
check(
  "different → different",
  compareClientField("identity.pronouns", suggestions, differentPronouns),
  { label: "he/him", kind: "different" }
)

const states = clientFieldStates(suggestions, differentPronouns, {})
const waiting = waitingClientFields(states)
assert.ok(
  waiting.some((s) => s.fieldKey === "identity.pronouns" && s.kind === "different"),
  "pronouns waiting"
)
assert.ok(
  waiting.some((s) => s.fieldKey === "identity.sex" && s.kind === "empty"),
  "sex waiting empty"
)
assert.ok(
  waitingClientFieldsForSection(states, 3).length >= 2,
  "section 3 has waiting fields"
)
assert.equal(waitingClientFieldsForSection(states, 1).length, 0, "section 1 no client fields")
console.log("ok — waiting fields by section")

const decided = clientFieldStates(suggestions, differentPronouns, {
  "identity.pronouns": { choice: "kept", at: "2026-01-01T00:00:00.000Z" },
})
assert.equal(
  waitingClientFields(decided).some((s) => s.fieldKey === "identity.pronouns"),
  false,
  "kept stops waiting"
)
console.log("ok — Keep stops waiting")

check(
  "display label multi-field",
  clientFieldDisplayLabel("identity.pronouns", "he/him"),
  "Pronouns · he/him"
)
check("accept button singular", acceptClientChangesButtonLabel(1), "Accept 1 client change and confirm")
check(
  "accept button plural",
  acceptClientChangesButtonLabel(3),
  "Accept 3 client changes and confirm"
)

let answers = emptyInterviewAnswers()
answers = setClientDecision(answers, "identity.pronouns", "used", "2026-06-01T00:00:00.000Z")
check("setClientDecision records used", answers.clientDecisions["identity.pronouns"], {
  choice: "used",
  at: "2026-06-01T00:00:00.000Z",
})

const source: InterviewAnswersJson = {
  version: 1,
  items: { s3_identity: { value: "confirmed", confirmed: true } },
  sections: { "3": { confirmed: true, confirmedAt: "2026-01-01T00:00:00.000Z" } },
  clientDecisions: {
    "identity.pronouns": { choice: "kept", at: "2026-01-01T00:00:00.000Z" },
  },
}
const review = prefillAnswersForReview(source)
check("review prefill drops clientDecisions", review.clientDecisions, {})
check("review prefill drops sections", review.sections, {})

const sanitized = sanitizeInterviewAnswers({
  version: 1,
  items: {},
  clientDecisions: {
    "identity.sex": { choice: "used", at: "2026-02-02T00:00:00.000Z" },
    bad: { choice: "maybe", at: "x" },
  },
})
check("sanitize keeps valid decision", sanitized.clientDecisions["identity.sex"], {
  choice: "used",
  at: "2026-02-02T00:00:00.000Z",
})
check("sanitize drops bad decision", sanitized.clientDecisions.bad, undefined)

// --- Field states: same / empty / different / none, with decisions ---

function stateOf(
  fieldKey: ClientFieldKey,
  demographics: Demographics,
  decisions: Parameters<typeof clientFieldStates>[2] = {}
) {
  const state = clientFieldStates(suggestions, demographics, decisions).find((s) => s.fieldKey === fieldKey)!
  return { kind: state.kind, decision: state.decision, waiting: state.waiting }
}

const fileWithSex = { ...emptyDemo, identity: { ...emptyDemo.identity, sex: "Male", pronouns: "she/her" } }
check("state same: not waiting", stateOf("identity.sex", fileWithSex), {
  kind: "same",
  decision: null,
  waiting: false,
})
check("state empty: waiting", stateOf("identity.sex", emptyDemo), { kind: "empty", decision: null, waiting: true })
check("state different: waiting", stateOf("identity.pronouns", fileWithSex), {
  kind: "different",
  decision: null,
  waiting: true,
})
check("state none: no client answer, not waiting", stateOf("identity.religion", fileWithSex), {
  kind: "none",
  decision: null,
  waiting: false,
})
check(
  "state different + kept: still different, not waiting",
  stateOf("identity.pronouns", fileWithSex, { "identity.pronouns": { choice: "kept", at: "x" } }),
  { kind: "different", decision: "kept", waiting: false }
)
check(
  "state empty + kept: stays empty, not waiting",
  stateOf("identity.sex", emptyDemo, { "identity.sex": { choice: "kept", at: "x" } }),
  { kind: "empty", decision: "kept", waiting: false }
)
check(
  "a decision without a client answer is ignored",
  stateOf("identity.religion", fileWithSex, { "identity.religion": { choice: "kept", at: "x" } }),
  { kind: "none", decision: null, waiting: false }
)
check(
  "states for one item",
  clientFieldStatesForItem(clientFieldStates(suggestions, fileWithSex, {}), "s3_financial").map((s) => s.fieldKey),
  ["occupation.necessities"]
)
check(
  "section 7 waiting: housing type empty",
  waitingClientFieldsForSection(clientFieldStates(suggestions, emptyDemo, {}), 7).map((s) => s.fieldKey),
  ["living.housingType"]
)
check(
  "section 3 waiting stops once every field is decided",
  waitingClientFieldsForSection(
    clientFieldStates(suggestions, differentPronouns, {
      "identity.sex": { choice: "used", at: "x" },
      "identity.pronouns": { choice: "kept", at: "x" },
      "occupation.necessities": { choice: "kept", at: "x" },
    }),
    3
  ),
  []
)

// Household: the file keeps only the household, so a matching household is the same answer.
const livesWithPartner: ClientBackgroundSuggestions = {
  ...suggestions,
  living: { livesWith: { label: "Partner", apply: { livesWith: "with_partner", livesWithOther: "" } } },
}
const livesWithOther: ClientBackgroundSuggestions = {
  ...suggestions,
  living: { livesWith: { label: "Flatmates", apply: { livesWith: "other", livesWithOther: "Flatmates" } } },
}
const withOthers = { ...emptyDemo, livingSituation: { ...emptyDemo.livingSituation, household: "with_others" as const } }
const alone = { ...emptyDemo, livingSituation: { ...emptyDemo.livingSituation, household: "alone" as const } }
check("lives with: no household → empty", compareClientField("living.livesWith", livesWithPartner, emptyDemo)?.kind, "empty")
check("lives with partner vs with others → same", compareClientField("living.livesWith", livesWithPartner, withOthers)?.kind, "same")
check("lives with other (flatmates) vs with others → same", compareClientField("living.livesWith", livesWithOther, withOthers)?.kind, "same")
check("lives with partner vs alone → different", compareClientField("living.livesWith", livesWithPartner, alone)?.kind, "different")

// --- applyClientField: values come from the self-report; result matches the client ---

const full: ClientBackgroundSuggestions = {
  identity: {
    sex: { label: "Female", apply: "Female" },
    genderIdentity: { label: "Non-binary", apply: "Non-binary" },
    pronouns: { label: "they/them", apply: "they/them" },
    sexualOrientation: { label: "Bisexual", apply: { sexualOrientation: "bisexual", sexualOrientationOther: "" } },
    raceEthnicity: { label: "Greek Australian", apply: "Greek Australian" },
    religion: { label: "Orthodox", apply: "Orthodox" },
    primaryLanguage: { label: "English", apply: "English" },
    disability: { label: "Yes — ADHD", apply: { value: true, detail: "ADHD" } },
  },
  education: {
    level: { label: "Bachelor degree", apply: "Bachelor degree" },
    fieldOfStudy: { label: "Nursing", apply: "Nursing" },
    currentlyStudying: { label: "No", apply: { value: false, detail: "" } },
    disruption: { label: "Yes — illness", apply: { value: true, detail: "illness" } },
  },
  occupation: {
    workStatus: { label: "Full-time", apply: { workStatus: "full_time", workStatusOther: "" } },
    role: { label: "Nurse", apply: "Nurse" },
    employer: { label: "Local Health", apply: "Local Health" },
    previousJob: { label: "Barista · Café", apply: { role: "Barista", employer: "Café" } },
    necessities: { label: "Food", apply: { ...emptyNecessities(), food: true } },
  },
  living: {
    housingType: { label: "Private rental", apply: "Private rental" },
    livesWith: { label: "Partner", apply: { livesWith: "with_partner", livesWithOther: "" } },
    housingStability: { label: "Secure", apply: "Secure" },
  },
  history: {},
  medication: {},
  stressors: {},
}

let applied: Demographics = emptyDemographics()
for (const fieldKey of [
  "identity.sex",
  "identity.genderIdentity",
  "identity.pronouns",
  "identity.sexualOrientation",
  "identity.raceEthnicity",
  "identity.religion",
  "identity.primaryLanguage",
  "identity.disability",
  "education.level",
  "education.fieldOfStudy",
  "education.currentlyStudying",
  "education.disruption",
  "occupation.workStatus",
  "occupation.role",
  "occupation.employer",
  "occupation.previousJob",
  "occupation.necessities",
  "living.housingType",
  "living.livesWith",
  "living.housingStability",
] as const) {
  const result = applyClientField(fieldKey, full, applied)
  assert.ok(result.ok, `apply ${fieldKey}: ${result.ok ? "" : result.error}`)
  applied = result.demographics
  assert.equal(compareClientField(fieldKey, full, applied)?.kind, "same", `${fieldKey} same after Use`)
}
console.log("ok — every client field applies and then matches")
check("apply writes the self-report value", applied.identity.pronouns, "they/them")
check("apply gender keeps genderDiffersFromSex in step", applied.identity.genderDiffersFromSex, true)
check("apply yes/no detail", [applied.identity.disability, applied.identity.disabilityDetail], [true, "ADHD"])
check("apply household from lives-with", applied.livingSituation.household, "with_others")
check("apply previous job appends", applied.occupation.previousJobs.map((job) => [job.role, job.employer]), [
  ["Barista", "Café"],
])
applyClientField("identity.sex", full, emptyDemo)
check("apply doesn't change the record it was given", emptyDemo.identity.sex, "")

const unemployedFile = {
  ...emptyDemo,
  occupation: { ...emptyDemo.occupation, workStatus: "unemployed" as const },
}
const roleBlocked = applyClientField("occupation.role", full, unemployedFile)
assert.equal(roleBlocked.ok, false, "role needs an employed work status")
assert.match(roleBlocked.ok ? "" : roleBlocked.error, /work status/)
console.log("ok — role refuses without an employed work status")
check(
  "apply without a client answer refuses",
  applyClientField("identity.religion", suggestions, emptyDemo),
  { ok: false, error: "The client didn't answer this in the self-report." }
)
check("apply with no self-report refuses", applyClientField("identity.sex", null, emptyDemo).ok, false)

console.log("interview-client-fields.selftest.ts: ok")
