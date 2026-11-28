import assert from "node:assert/strict"

import {
  acceptClientChangesButtonLabel,
  clientFieldDisplayLabel,
  clientFieldStates,
  compareClientField,
  waitingClientFields,
  waitingClientFieldsForSection,
} from "@/lib/client-background/interview-client-fields"
import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import { emptyDemographics, emptyNecessities } from "@/lib/client-background/types"
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

console.log("interview-client-fields.selftest.ts: ok")
