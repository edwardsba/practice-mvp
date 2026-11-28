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
  "section 2 presence items no longer contradict",
  interviewContradictionNotes({
    ...base,
    answers: {
      s2_medicare: { value: "no" },
      s2_ndis: { value: "not_applicable" },
      s2_insurance: { value: "no" },
    },
    medicareClaimExists: true,
    ndisClaimCount: 2,
    insurerClaimCount: 1,
  }),
  []
)

check(
  "section 4 presence items no longer contradict",
  interviewContradictionNotes({
    ...base,
    answers: {
      s4_emergency: { value: "no" },
      s4_gp: { value: "not_applicable" },
      s4_other_professionals: { value: "no" },
    },
    emergencyContactCount: 2,
    gpCount: 1,
    otherProfessionalCount: 3,
  }),
  []
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
    answers: { s5_current: { value: "yes" } },
    relationshipHasEntries: { s5_current: true },
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
