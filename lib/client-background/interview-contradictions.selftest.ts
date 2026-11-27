import assert from "node:assert/strict"

import { interviewContradictionNotes } from "@/lib/client-background/interview-contradictions"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const base = {
  answers: {} as Record<string, { value: string } | undefined>,
  medicareClaimExists: false,
  ndisClaimCount: 0,
  insurerClaimCount: 0,
  emergencyContactCount: 0,
  gpCount: 0,
  otherProfessionalCount: 0,
  historyHasEntries: {} as Record<string, boolean>,
  relationshipHasEntries: {} as Record<string, boolean>,
}

check("no notes when empty", interviewContradictionNotes(base), [])

check(
  "medicare no + claim",
  interviewContradictionNotes({
    ...base,
    answers: { s2_medicare: { value: "no" } },
    medicareClaimExists: true,
  }).map((n) => n.message),
  ["A Medicare claim is on file."]
)

check(
  "ndis na + one claim",
  interviewContradictionNotes({
    ...base,
    answers: { s2_ndis: { value: "not_applicable" } },
    ndisClaimCount: 1,
  }).map((n) => n.message),
  ["An NDIS claim is on file. Check this answer."]
)

check(
  "ndis no + two claims",
  interviewContradictionNotes({
    ...base,
    answers: { s2_ndis: { value: "no" } },
    ndisClaimCount: 2,
  }).map((n) => n.message),
  ["2 NDIS claims are on file. Check this answer."]
)

check(
  "insurance claim",
  interviewContradictionNotes({
    ...base,
    answers: { s2_insurance: { value: "no" } },
    insurerClaimCount: 1,
  }).map((n) => n.message),
  ["An insurance or WorkCover claim is on file. Check this answer."]
)

check(
  "emergency contacts plural",
  interviewContradictionNotes({
    ...base,
    answers: { s4_emergency: { value: "no" } },
    emergencyContactCount: 2,
  }).map((n) => n.message),
  ["2 emergency contacts are on file."]
)

check(
  "gp on file",
  interviewContradictionNotes({
    ...base,
    answers: { s4_gp: { value: "not_applicable" } },
    gpCount: 1,
  }).map((n) => n.message),
  ["A GP is on file."]
)

check(
  "other professionals",
  interviewContradictionNotes({
    ...base,
    answers: { s4_other_professionals: { value: "no" } },
    otherProfessionalCount: 3,
  }).map((n) => n.message),
  ["3 treating professionals are on file."]
)

check(
  "relationship children",
  interviewContradictionNotes({
    ...base,
    answers: { s5_children: { value: "no" } },
    relationshipHasEntries: { s5_children: true },
  }).map((n) => ({ key: n.itemKey, message: n.message, target: n.target })),
  [
    {
      key: "s5_children",
      message: "Children entries are on file.",
      target: "relationships",
    },
  ]
)

check(
  "history mental health",
  interviewContradictionNotes({
    ...base,
    answers: { s8_emotional_problems: { value: "no" } },
    historyHasEntries: { s8_emotional_problems: true },
  }).map((n) => n.message),
  ["Mental health entries are on file."]
)

check(
  "yes answer does not contradict",
  interviewContradictionNotes({
    ...base,
    answers: { s2_medicare: { value: "yes" } },
    medicareClaimExists: true,
  }),
  []
)

check(
  "section 7 household alone contradiction",
  interviewContradictionNotes({
    ...base,
    householdAloneWithSomeoneLiving: true,
  }).map((n) => ({ key: n.itemKey, message: n.message })),
  [
    {
      key: "s7_who",
      message: "Someone is recorded as living with the client.",
    },
  ]
)

check(
  "section 7 no contradiction flag",
  interviewContradictionNotes({
    ...base,
    householdAloneWithSomeoneLiving: false,
  }),
  []
)

console.log("interview-contradictions.selftest.ts: ok")
