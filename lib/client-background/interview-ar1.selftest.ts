/**
 * Round AR.1: section 4 contact grouping (EC vs MC), presence details for
 * funding / disability / financial / contacts, and Confirm deriving yes / n/a.
 */
import assert from "node:assert/strict"

import {
  confirmSectionAnswers,
  emptyInterviewAnswers,
  INTERVIEW_SECTIONS,
  isDetailsKind,
  isQuestionKind,
  questionItemsInSection,
  readableValuesForKind,
  sanitizeInterviewAnswers,
  section4ExtraItems,
  section4ExtrasAfterParent,
  unansweredQuestionCount,
} from "@/lib/client-background/interview-answers"
import {
  demographicDetailPresence,
  detailPresenceForInterview,
} from "@/lib/client-background/interview-detail-presence"
import { emptyDemographics } from "@/lib/client-background/types"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const section2 = INTERVIEW_SECTIONS.find((s) => s.number === 2)!
const section3 = INTERVIEW_SECTIONS.find((s) => s.number === 3)!
const section4 = INTERVIEW_SECTIONS.find((s) => s.number === 4)!

// --- Part 1: emergency contacts only under Emergency contact ---

const extras = section4ExtraItems({
  answers: emptyInterviewAnswers(),
  emergencyContacts: [
    { id: "jane", label: "Jane" },
    { id: "john", label: "John" },
  ],
  gpContacts: [{ id: "gp1", label: "Dr GP" }],
  otherMedicalContacts: [{ id: "physio", label: "Physio" }],
})
const gpIds = new Set(["gp1"])

check(
  "emergency extras under Emergency contact only",
  section4ExtrasAfterParent("s4_emergency", extras, gpIds).map((item) => item.key),
  ["s4_ec:jane", "s4_ec:john"]
)
check(
  "GP extras under GP only (no emergency ids)",
  section4ExtrasAfterParent("s4_gp", extras, gpIds).map((item) => item.key),
  ["s4_mc:gp1"]
)
check(
  "other professionals under Other only (no emergency ids)",
  section4ExtrasAfterParent("s4_other_professionals", extras, gpIds).map((item) => item.key),
  ["s4_mc:physio"]
)

const allGrouped = [
  ...section4ExtrasAfterParent("s4_emergency", extras, gpIds),
  ...section4ExtrasAfterParent("s4_gp", extras, gpIds),
  ...section4ExtrasAfterParent("s4_other_professionals", extras, gpIds),
]
check(
  "each section 4 record appears once across parents",
  allGrouped.map((item) => item.key).sort(),
  ["s4_ec:jane", "s4_ec:john", "s4_mc:gp1", "s4_mc:physio"].sort()
)

// --- Part 2: kinds and question counts ---

check(
  "section 2 items are presence details",
  section2.items.map((item) => ({ key: item.key, kind: item.kind, details: isDetailsKind(item.kind) })),
  [
    { key: "s2_medicare", kind: "presence", details: true },
    { key: "s2_ndis", kind: "presence", details: true },
    { key: "s2_insurance", kind: "presence", details: true },
  ]
)
check(
  "section 4 parents are presence details",
  section4.items.map((item) => ({ key: item.key, kind: item.kind, question: isQuestionKind(item.kind) })),
  [
    { key: "s4_emergency", kind: "presence", question: false },
    { key: "s4_gp", kind: "presence", question: false },
    { key: "s4_other_professionals", kind: "presence", question: false },
  ]
)
check(
  "section 3 disability and financial are presence",
  section3.items
    .filter((item) => item.key === "s3_disability" || item.key === "s3_financial")
    .map((item) => item.kind),
  ["presence", "presence"]
)

check("section 2 has no questions", questionItemsInSection(section2).length, 0)
check("section 4 has no questions", questionItemsInSection(section4, extras).length, 0)
check(
  "section 3 questions exclude disability and financial",
  questionItemsInSection(section3).map((item) => item.key),
  []
)
check("section 2 unanswered questions empty", unansweredQuestionCount(section2, emptyInterviewAnswers()), 0)
check("section 4 unanswered questions empty", unansweredQuestionCount(section4, emptyInterviewAnswers(), extras), 0)
check("section 3 unanswered questions empty", unansweredQuestionCount(section3, emptyInterviewAnswers()), 0)

check("presence allows yes / n/a on write", readableValuesForKind("presence").includes("no"), true)

const legacyNo = sanitizeInterviewAnswers({
  version: 1,
  items: {
    s2_medicare: { value: "no", confirmed: true },
    s4_gp: { value: "no", confirmed: false },
    s3_disability: { value: "yes", confirmed: true },
  },
})
check("sanitize keeps legacy presence no", legacyNo.items.s2_medicare, { value: "no", confirmed: true })
check("sanitize keeps legacy presence no unconfirmed", legacyNo.items.s4_gp, {
  value: "no",
  confirmed: false,
})
check("sanitize keeps presence yes", legacyNo.items.s3_disability, { value: "yes", confirmed: true })

// --- Confirm derives yes / not_applicable from stored data ---

const demo = emptyDemographics()
demo.identity.disability = true
demo.occupation.financialConcerns = false

const presence = detailPresenceForInterview({
  clientDisplayName: "Ben",
  preferredName: null,
  dateOfBirth: null,
  ageLabel: "",
  phone: null,
  email: null,
  address: null,
  comms: {
    commsOptOut: false,
    reminderOptOut: false,
    preSessionOptOut: false,
    postSessionOptOut: false,
    adminCommsOptOut: false,
    onlineBookingPermitted: false,
  },
  demographics: demo,
  relationships: [],
  blocks: [],
  emergencyContacts: [
    { id: "jane", name: "Jane", role: "Sister", phone: "0400", email: null },
    { id: "john", name: "John", role: "Friend", phone: null, email: null },
  ],
  medicalContacts: [
    { id: "gp1", name: "Dr GP", organisationName: null, phone: null, isMain: true },
    { id: "physio", name: "Physio", organisationName: null, phone: null, isMain: false },
  ],
  medicareClaimExists: true,
  ndisClaimCount: 0,
  insurerClaimCount: 2,
  gpCount: 1,
  otherProfessionalCount: 1,
})

check("presence medicare yes when claim exists", presence.s2_medicare, true)
check("presence ndis empty", presence.s2_ndis, false)
check("presence insurance when claims", presence.s2_insurance, true)
check("presence emergency when contacts", presence.s4_emergency, true)
check("presence gp when count", presence.s4_gp, true)
check("presence other when count", presence.s4_other_professionals, true)
check("presence disability when true", presence.s3_disability, true)
check("presence financial only when concern is yes", presence.s3_financial, false)

const demoPresence = demographicDetailPresence(demo, [])
check("demographic presence disability", demoPresence.s3_disability, true)
check("demographic presence financial false", demoPresence.s3_financial, false)

const confirmedS2 = confirmSectionAnswers(
  emptyInterviewAnswers(),
  2,
  {
    s2_medicare: true,
    s2_ndis: false,
    s2_insurance: true,
  },
  [],
  "2026-11-28T01:00:00.000Z"
)
assert.equal(confirmedS2.ok, true, "section 2 confirms with no questions")
if (confirmedS2.ok) {
  check("confirm medicare → yes", confirmedS2.answers.items.s2_medicare, {
    value: "yes",
    confirmed: true,
  })
  check("confirm ndis empty → n/a", confirmedS2.answers.items.s2_ndis, {
    value: "not_applicable",
    confirmed: true,
  })
  check("confirm insurance → yes", confirmedS2.answers.items.s2_insurance, {
    value: "yes",
    confirmed: true,
  })
}

const confirmedS4 = confirmSectionAnswers(
  {
    version: 1,
    items: {
      s4_emergency: { value: "no", confirmed: false },
      s4_gp: { value: "yes", confirmed: false },
    },
    sections: {},
    clientDecisions: {},
  },
  4,
  {
    s4_emergency: true,
    s4_gp: false,
    s4_other_professionals: true,
    "s4_ec:jane": true,
    "s4_ec:john": true,
    "s4_mc:gp1": true,
    "s4_mc:physio": false,
  },
  extras,
  "2026-11-28T01:00:00.000Z"
)
assert.equal(confirmedS4.ok, true, "section 4 confirms with no questions")
if (confirmedS4.ok) {
  check("confirm replaces legacy emergency answer from data", confirmedS4.answers.items.s4_emergency, {
    value: "yes",
    confirmed: true,
  })
  check("confirm gp empty → n/a (replaces prior yes)", confirmedS4.answers.items.s4_gp, {
    value: "not_applicable",
    confirmed: true,
  })
  check("confirm other professionals → yes", confirmedS4.answers.items.s4_other_professionals, {
    value: "yes",
    confirmed: true,
  })
  check("per-record EC confirmed", confirmedS4.answers.items["s4_ec:jane"], {
    value: "confirmed",
    confirmed: true,
  })
}

const confirmedS3 = confirmSectionAnswers(
  emptyInterviewAnswers(),
  3,
  {
    s3_identity: true,
    s3_disability: true,
    s3_education: false,
    s3_occupation: false,
    s3_financial: false,
  },
  [],
  "2026-11-28T01:00:00.000Z"
)
assert.equal(confirmedS3.ok, true, "section 3 confirms with no questions")
if (confirmedS3.ok) {
  check("confirm disability → yes from data", confirmedS3.answers.items.s3_disability, {
    value: "yes",
    confirmed: true,
  })
  check("confirm financial → n/a from data", confirmedS3.answers.items.s3_financial, {
    value: "not_applicable",
    confirmed: true,
  })
  check("confirm identity still cna confirmed", confirmedS3.answers.items.s3_identity, {
    value: "confirmed",
    confirmed: true,
  })
}

console.log("interview-ar1.selftest.ts: ok")
