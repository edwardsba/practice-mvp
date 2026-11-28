import assert from "node:assert/strict"

import {
  applyNothingToRecord,
  blockAnswersFromInterview,
  dropMissingPerRecordAnswers,
  emptyInterviewAnswers,
  INTERVIEW_SECTIONS,
  interviewItemStatus,
  interviewSectionStatus,
  isValueAllowedForKind,
  mirrorBlockValue,
  mirrorScreeningValue,
  prefillAnswersForReview,
  sanitizeInterviewAnswers,
  screeningFromInterviewAnswers,
  section4ExtraItems,
  setItemAnswer,
  validateItemAnswer,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"
import { formatSection3FactLines } from "@/lib/client-background/interview-facts"
import { emptyDemographics } from "@/lib/client-background/types"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check("empty item → left", interviewItemStatus(undefined), "left")
check(
  "unconfirmed value → to_confirm",
  interviewItemStatus({ value: "yes", confirmed: false }),
  "to_confirm"
)
check("confirmed value → done", interviewItemStatus({ value: "yes", confirmed: true }), "done")

const section1 = INTERVIEW_SECTIONS[0]
const empty = emptyInterviewAnswers()
check(
  "empty section → not_started",
  interviewSectionStatus(section1, empty).status,
  "not_started"
)
check("section 1 is all details — nothing to answer", interviewSectionStatus(section1, empty).left, 0)

const prefilled: InterviewAnswersJson = {
  version: 1,
  items: Object.fromEntries(section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: false }])),
  sections: {},
  clientDecisions: {},
}
check("pre-filled details → to_confirm", interviewSectionStatus(section1, prefilled).status, "to_confirm")
check("pre-filled details → Ready to confirm (no count)", interviewSectionStatus(section1, prefilled).toConfirm, 0)

const mixed: InterviewAnswersJson = {
  version: 1,
  items: {
    [section1.items[0].key]: { value: "confirmed", confirmed: true },
  },
  sections: {},
  clientDecisions: {},
}
check("one detail touched → to_confirm", interviewSectionStatus(section1, mixed).status, "to_confirm")

const allItemsConfirmed: InterviewAnswersJson = {
  version: 1,
  items: Object.fromEntries(section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: true }])),
  sections: {},
  clientDecisions: {},
}
check(
  "every item confirmed but section not signed off → to_confirm",
  interviewSectionStatus(section1, allItemsConfirmed).status,
  "to_confirm"
)
const done: InterviewAnswersJson = {
  ...allItemsConfirmed,
  sections: { "1": { confirmed: true, confirmedAt: "2026-11-27T00:00:00.000Z" } },
}
check("section confirmed → done", interviewSectionStatus(section1, done).status, "done")

const section4 = INTERVIEW_SECTIONS.find((s) => s.number === 4)!
const partial: InterviewAnswersJson = {
  version: 1,
  items: {
    s4_emergency: { value: "yes", confirmed: true },
  },
  sections: {},
  clientDecisions: {},
}
const afterNothing = applyNothingToRecord(partial, 4)
check("nothing to record keeps existing", afterNothing.items.s4_emergency, {
  value: "yes",
  confirmed: true,
})
check("nothing to record fills unanswered", afterNothing.items.s4_gp, {
  value: "not_applicable",
  confirmed: true,
})
check("nothing to record fills remaining", afterNothing.items.s4_other_professionals, {
  value: "not_applicable",
  confirmed: true,
})
assert.equal(section4.items.length, 3)

const source: InterviewAnswersJson = {
  version: 1,
  items: {
    s1_name: { value: "confirmed", confirmed: true },
    s8_emotional_problems: { value: "yes", confirmed: true },
  },
  sections: { "1": { confirmed: true, confirmedAt: "2026-11-27T00:00:00.000Z" } },
  clientDecisions: { "identity.sex": { choice: "used", at: "2026-11-27T00:00:00.000Z" } },
}
const review = prefillAnswersForReview(source)
check("review prefill copies values with confirmed false, no section sign-off or client decisions", review, {
  version: 1,
  items: {
    s1_name: { value: "confirmed", confirmed: false },
    s8_emotional_problems: { value: "yes", confirmed: false },
  },
  sections: {},
  clientDecisions: {},
})

const tapped = setItemAnswer(
  {
    version: 1,
    items: { s2_medicare: { value: "yes", confirmed: false } },
    sections: {},
    clientDecisions: {},
  },
  "s2_medicare",
  "yes"
)
check("tapping same answer confirms", tapped.items.s2_medicare, { value: "yes", confirmed: true })

check("screening mirror yes", mirrorScreeningValue("yes"), "yes")
check("screening mirror no", mirrorScreeningValue("no"), "no")
check("screening mirror not_applicable → no", mirrorScreeningValue("not_applicable"), "no")
check("screening mirror confirmed ignored", mirrorScreeningValue("confirmed"), null)

check("block mirror yes", mirrorBlockValue("yes"), "yes")
check("block mirror no → none", mirrorBlockValue("no"), "none")
check("block mirror not_applicable → none", mirrorBlockValue("not_applicable"), "none")
check("block mirror unanswered", mirrorBlockValue(undefined), "")

const withHistory: InterviewAnswersJson = {
  version: 1,
  items: {
    s8_emotional_problems: { value: "yes", confirmed: true },
    s8_substance_use: { value: "not_applicable", confirmed: true },
    s9_family_emotional_problems: { value: "no", confirmed: true },
    s5_previous: { value: "yes", confirmed: true },
    s6_mother_other: { value: "yes", confirmed: true },
    s6_father_other: { value: "not_applicable", confirmed: true },
    s6_caregiver: { value: "no", confirmed: true },
  },
  sections: {},
  clientDecisions: {},
}
check("screeningFromInterviewAnswers mapping", screeningFromInterviewAnswers(withHistory), {
  emotional_problems: "yes",
  substance_use: "no",
  family_emotional_problems: "no",
})
check("mother mirror only mother column", blockAnswersFromInterview(withHistory), {
  previousRelationships: "yes",
  motherOtherRelationships: "yes",
  fatherOtherRelationships: "none",
  caregiverArrangements: "none",
})

const section6 = INTERVIEW_SECTIONS.find((s) => s.number === 6)!
check(
  "section 6 item keys",
  section6.items.map((item) => item.key),
  ["s6_biological_parents", "s6_mother_other", "s6_father_other", "s6_caregiver", "s6_siblings"]
)

const droppedParentsOther = sanitizeInterviewAnswers({
  version: 1,
  items: {
    s6_parents_other: { value: "yes", confirmed: true },
    s6_mother_other: { value: "no", confirmed: true },
  },
})
check("old s6_parents_other dropped on sanitize", droppedParentsOther.items.s6_parents_other, undefined)
check("new mother key kept", droppedParentsOther.items.s6_mother_other, { value: "no", confirmed: true })

check("yna allows yes", isValueAllowedForKind("yna", "yes"), true)
check("yna rejects confirmed", isValueAllowedForKind("yna", "confirmed"), false)
check("cna allows confirmed", isValueAllowedForKind("cna", "confirmed"), true)
check("cna rejects yes", isValueAllowedForKind("cna", "yes"), false)
check("ya rejects no", isValueAllowedForKind("ya", "no"), false)
check("living allows lives_alone", isValueAllowedForKind("living", "lives_alone"), true)
check("living rejects yes", isValueAllowedForKind("living", "yes"), false)

check("validate unknown key", validateItemAnswer("s99_nope", "yes"), {
  ok: false,
  error: "Unknown interview item.",
})
check("validate wrong value for cna", validateItemAnswer("s1_name", "yes"), {
  ok: false,
  error: "That answer is not allowed for this item.",
})
check("validate ok ya", validateItemAnswer("s2_medicare", "yes"), { ok: true, value: "yes" })

check("validate s4_ec allows confirmed", validateItemAnswer("s4_ec:abc", "confirmed"), {
  ok: true,
  value: "confirmed",
})
check("validate s4_ec allows not_applicable", validateItemAnswer("s4_ec:abc", "not_applicable"), {
  ok: true,
  value: "not_applicable",
})
check("validate s4_ec rejects yes", validateItemAnswer("s4_ec:abc", "yes"), {
  ok: false,
  error: "That answer is not allowed for this item.",
})
check("validate s4_mc allows confirmed", validateItemAnswer("s4_mc:xyz", "confirmed"), {
  ok: true,
  value: "confirmed",
})

check(
  "dropMissingPerRecordAnswers drops unknown ids",
  dropMissingPerRecordAnswers(
    {
      version: 1,
      items: {
        "s4_ec:gone": { value: "confirmed", confirmed: true },
        "s4_ec:live": { value: "confirmed", confirmed: true },
        "s4_mc:gone": { value: "not_applicable", confirmed: true },
      },
      sections: {},
      clientDecisions: {},
    },
    { emergencyContactIds: ["live"], medicalContactIds: [] }
  ).items,
  { "s4_ec:live": { value: "confirmed", confirmed: true } }
)

check(
  "prefill copies per-record unconfirmed",
  prefillAnswersForReview({
    version: 1,
    items: {
      "s4_ec:live": { value: "confirmed", confirmed: true },
      "s4_mc:mc1": { value: "not_applicable", confirmed: true },
    },
    sections: {},
    clientDecisions: {},
  }),
  {
    version: 1,
    items: {
      "s4_ec:live": { value: "confirmed", confirmed: false },
      "s4_mc:mc1": { value: "not_applicable", confirmed: false },
    },
    sections: {},
    clientDecisions: {},
  }
)

assert.equal(section1.items.length, 7)
check("section1 includes s1_preferred_name", section1.items.some((item) => item.key === "s1_preferred_name"), true)

const section4Extras = section4ExtraItems({
  answers: {
    version: 1,
    items: {
      s4_emergency: { value: "yes", confirmed: true },
      s4_gp: { value: "yes", confirmed: true },
    },
    sections: {},
    clientDecisions: {},
  },
  emergencyContacts: [{ id: "ec1", label: "Parent" }],
  gpContacts: [{ id: "gp1", label: "Dr Smith" }],
  otherMedicalContacts: [],
})
check(
  "section4ExtraItems always when records exist",
  section4Extras.map((item) => item.key),
  ["s4_ec:ec1", "s4_mc:gp1"]
)
const section4ExtrasUnanswered = section4ExtraItems({
  answers: emptyInterviewAnswers(),
  emergencyContacts: [{ id: "ec1", label: "Parent" }],
  gpContacts: [{ id: "gp1", label: "Dr Smith" }],
  otherMedicalContacts: [],
})
check(
  "section4ExtraItems before parent answered",
  section4ExtrasUnanswered.map((item) => item.key),
  ["s4_ec:ec1", "s4_mc:gp1"]
)
check(
  "section 4 left counts unanswered questions only (per-record rows are details)",
  interviewSectionStatus(
    section4,
    {
      version: 1,
      items: { s4_emergency: { value: "yes", confirmed: true } },
      sections: {},
      clientDecisions: {},
    },
    section4Extras
  ).left,
  2
)

const wrongSanitized = sanitizeInterviewAnswers({
  version: 1,
  items: {
    s1_name: { value: "yes", confirmed: true },
    s2_medicare: { value: "confirmed", confirmed: true },
    s7_who: { value: "not_applicable", confirmed: true },
    s3_identity: { value: "confirmed", confirmed: false },
  },
})
check("sanitize drops wrong-typed values (old JSON gets empty sections)", wrongSanitized, {
  version: 1,
  items: {
    s7_who: { value: "not_applicable", confirmed: true },
    s3_identity: { value: "confirmed", confirmed: false },
  },
  sections: {},
  clientDecisions: {},
})

const droppedLivingWho = sanitizeInterviewAnswers({
  version: 1,
  items: {
    s7_who: { value: "lives_with_others", confirmed: true },
    s7_housing_type: { value: "confirmed", confirmed: false },
  },
})
check("sanitize drops legacy living answers on s7_who", droppedLivingWho, {
  version: 1,
  items: {
    s7_housing_type: { value: "confirmed", confirmed: false },
  },
  sections: {},
  clientDecisions: {},
})

const demo = emptyDemographics()
demo.identity.sex = "Female"
demo.identity.genderDiffersFromSex = true
demo.identity.genderIdentity = "Non-binary"
demo.identity.pronouns = "They/them"
demo.identity.sexualOrientation = "queer"
demo.identity.raceEthnicity = "Australian"
demo.identity.religion = ""
demo.identity.primaryLanguage = "English"
demo.identity.disability = true
demo.identity.disabilityDetail = "Hearing"
demo.identity.accessibilityNeeds = "Auslan"
demo.education.level = "Bachelor degree"
demo.education.fieldOfStudy = ""
demo.education.currentlyStudying = false
demo.occupation.workStatus = "full_time"
demo.occupation.role = "Nurse"
demo.occupation.employer = "Local Health"
demo.occupation.financialConcerns = true
demo.occupation.financialConcernsDetail = "Rent"
demo.occupation.necessities.food = true
demo.occupation.necessities.transport = true

const facts = formatSection3FactLines(demo)
check("section3 identity omits empty religion", facts.s3_identity, [
  "Sex: Female",
  "Gender: Non-binary",
  "Pronouns: They/them",
  "Sexual orientation: Queer",
  "Cultural or ethnic background: Australian",
  "Main language: English",
])
check("section3 disability lines", facts.s3_disability, [
  "Disability: Yes — Hearing",
  "Access needs: Auslan",
])
check("section3 education omits empty field", facts.s3_education, [
  "Highest level: Bachelor degree",
  "Currently studying: No",
])
check("section3 occupation", facts.s3_occupation, [
  "Work status: Full-time",
  "Role and employer: Nurse · Local Health",
])
check("section3 financial", facts.s3_financial, [
  "Financial concerns: Yes — Rent",
  "Hard to afford: Food, Transport",
])

const blankFacts = formatSection3FactLines(emptyDemographics())
check("section3 empty identity → []", blankFacts.s3_identity, [])

const section8 = INTERVIEW_SECTIONS.find((s) => s.number === 8)!
const section9 = INTERVIEW_SECTIONS.find((s) => s.number === 9)!
check(
  "section 8 order and labels",
  section8.items.map((item) => ({ key: item.key, label: item.label })),
  [
    { key: "s8_illness_injury", label: "1. Physical health" },
    { key: "s8_substance_use", label: "2. Substance use" },
    { key: "s8_emotional_problems", label: "3. Mental health" },
    { key: "s8_self_harm", label: "4. Self-harm" },
    { key: "s8_traumatic_events", label: "5. Traumatic events" },
    { key: "s8_other_significant_events", label: "6. Other significant events" },
  ]
)
check(
  "section 9 order and labels",
  section9.items.map((item) => ({ key: item.key, label: item.label })),
  [
    { key: "s9_family_illness", label: "1. Physical health" },
    { key: "s9_family_substance_use", label: "2. Substance use" },
    { key: "s9_family_emotional_problems", label: "3. Mental health" },
    { key: "s9_family_self_harm", label: "4. Self-harm" },
    { key: "s9_family_significant_events", label: "5. Significant events" },
  ]
)
check("section 9 title", section9.title, "Significant other history")

const droppedOtherTreatment = sanitizeInterviewAnswers({
  version: 1,
  items: {
    s8_other_treatment: { value: "no", confirmed: true },
    s8_illness_injury: { value: "yes", confirmed: true },
  },
})
check("sanitize drops s8_other_treatment", droppedOtherTreatment, {
  version: 1,
  items: {
    s8_illness_injury: { value: "yes", confirmed: true },
  },
  sections: {},
  clientDecisions: {},
})

console.log("\ninterview-answers.selftest.ts: ok")
