import assert from "node:assert/strict"

import {
  canCreateClientAssessmentLink,
  orderSendableAssessments,
  qualifiesAsSendable,
  SEND_LIST_EXCEPTIONS,
} from "@/lib/assessments/sendable-assessments"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function checkTrue(name: string, value: boolean) {
  assert.equal(value, true, name)
  console.log(`ok — ${name}`)
}

// --- qualifiesAsSendable ---
checkTrue(
  "PHQ9 sendable",
  qualifiesAsSendable({
    assessmentCode: "PHQ9",
    isActive: true,
    clientCompletable: true,
    hasActiveElements: true,
  })
)

check(
  "LRAMP not sendable (not client-completable)",
  qualifiesAsSendable({
    assessmentCode: "LRAMP",
    isActive: true,
    clientCompletable: false,
    hasActiveElements: true,
  }),
  false
)

check(
  "mse not sendable",
  qualifiesAsSendable({
    assessmentCode: "mse",
    isActive: true,
    clientCompletable: false,
    hasActiveElements: true,
  }),
  false
)

checkTrue(
  "BACKGROUND_SR sendable when it has elements",
  qualifiesAsSendable({
    assessmentCode: "BACKGROUND_SR",
    isActive: true,
    clientCompletable: true,
    hasActiveElements: true,
  })
)

check(
  "BACKGROUND_SR refused without elements",
  qualifiesAsSendable({
    assessmentCode: "BACKGROUND_SR",
    isActive: true,
    clientCompletable: true,
    hasActiveElements: false,
  }),
  false
)

check("send list exceptions empty for now", Object.keys(SEND_LIST_EXCEPTIONS), [])

checkTrue(
  "BTP sendable without static elements",
  qualifiesAsSendable({
    assessmentCode: "BTP",
    isActive: true,
    clientCompletable: true,
    hasActiveElements: false,
  })
)

check(
  "inactive refused",
  qualifiesAsSendable({
    assessmentCode: "PHQ9",
    isActive: false,
    clientCompletable: true,
    hasActiveElements: true,
  }),
  false
)

check(
  "no elements refused (non-BTP)",
  qualifiesAsSendable({
    assessmentCode: "PSF",
    isActive: true,
    clientCompletable: true,
    hasActiveElements: false,
  }),
  false
)

// --- canCreateClientAssessmentLink ---
check(
  "link: PHQ9 allowed",
  canCreateClientAssessmentLink({
    isActive: true,
    clientCompletable: true,
  }),
  { ok: true }
)

check(
  "link: LRAMP refused",
  canCreateClientAssessmentLink({
    isActive: true,
    clientCompletable: false,
  }),
  { ok: false, error: "This assessment can't be sent to a client." }
)

check(
  "link: mse refused",
  canCreateClientAssessmentLink({
    isActive: true,
    clientCompletable: false,
  }),
  { ok: false, error: "This assessment can't be sent to a client." }
)

check(
  "link: inactive refused",
  canCreateClientAssessmentLink({
    isActive: false,
    clientCompletable: true,
  }),
  { ok: false, error: "Assessment definition not found." }
)

check(
  "link: missing refused",
  canCreateClientAssessmentLink(null),
  { ok: false, error: "Assessment definition not found." }
)

check(
  "link: BACKGROUND_SR allowed",
  canCreateClientAssessmentLink({
    isActive: true,
    clientCompletable: true,
  }),
  { ok: true }
)

// --- orderSendableAssessments ---
{
  const ordered = orderSendableAssessments([
    { assessmentCode: "PSF", displayLabel: "Post-Session Feedback" },
    { assessmentCode: "ASSIST", displayLabel: "ASSIST" },
    { assessmentCode: "DASS21", displayLabel: "DASS-21" },
    { assessmentCode: "PHQ9", displayLabel: "PHQ-9" },
    { assessmentCode: "BTP", displayLabel: "BTP" },
    { assessmentCode: "GAD7", displayLabel: "GAD-7" },
    { assessmentCode: "ASRM", displayLabel: "ASRM" },
  ])
  check(
    "order: battery first then A–Z",
    ordered.map((item) => item.assessmentCode),
    ["BTP", "PHQ9", "GAD7", "ASSIST", "ASRM", "DASS21", "PSF"]
  )
}

{
  const ordered = orderSendableAssessments([
    { assessmentCode: "gad7", displayLabel: "GAD-7" },
    { assessmentCode: "phq9", displayLabel: "PHQ-9" },
  ])
  // Leading block matches sequence by upper case; preserves first-seen item casing via map
  check(
    "order: case-insensitive battery match",
    ordered.map((item) => item.assessmentCode.toUpperCase()),
    ["PHQ9", "GAD7"]
  )
}

console.log("sendable-assessments.selftest.ts: ok")
