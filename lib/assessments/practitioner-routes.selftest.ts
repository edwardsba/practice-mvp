import assert from "node:assert/strict"

import {
  canCompleteInSharedForm,
  usesSharedResultsLayout,
} from "@/lib/assessments/practitioner-routes"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function gate(
  partial: Partial<Parameters<typeof canCompleteInSharedForm>[0]> & {
    assessmentCode: string
  }
) {
  return canCompleteInSharedForm({
    clientCompletable: false,
    practitionerCompletable: true,
    isActive: true,
    hasActiveElements: true,
    ...partial,
  })
}

check(
  "LRAMP → canComplete true",
  gate({ assessmentCode: "LRAMP", clientCompletable: false }),
  true
)

check(
  "ASQ → canComplete false (legacy)",
  gate({ assessmentCode: "ASQ", clientCompletable: false }),
  false
)

check(
  "mse → canComplete false (legacy)",
  gate({ assessmentCode: "mse", clientCompletable: false }),
  false
)

check(
  "PHQ9 → canComplete true (client + practitioner)",
  gate({
    assessmentCode: "PHQ9",
    clientCompletable: true,
    practitionerCompletable: true,
  }),
  true
)

check(
  "BTP → canComplete false (excluded)",
  gate({
    assessmentCode: "BTP",
    clientCompletable: true,
    practitionerCompletable: true,
  }),
  false
)

check(
  "BACKGROUND_SR → canComplete false (excluded)",
  gate({
    assessmentCode: "BACKGROUND_SR",
    clientCompletable: true,
    practitionerCompletable: true,
  }),
  false
)

check(
  "PSF → canComplete false (not practitioner-completable)",
  gate({
    assessmentCode: "PSF",
    clientCompletable: true,
    practitionerCompletable: false,
  }),
  false
)

check(
  "inactive → canComplete false",
  gate({ assessmentCode: "PHQ9", clientCompletable: true, isActive: false }),
  false
)

check(
  "no elements → canComplete false",
  gate({
    assessmentCode: "PHQ9",
    clientCompletable: true,
    hasActiveElements: false,
  }),
  false
)

check(
  "LRAMP → usesSharedResultsLayout true",
  usesSharedResultsLayout({
    assessmentCode: "LRAMP",
    clientCompletable: false,
    practitionerCompletable: true,
  }),
  true
)

check(
  "PHQ9 → usesSharedResultsLayout false",
  usesSharedResultsLayout({
    assessmentCode: "PHQ9",
    clientCompletable: true,
    practitionerCompletable: true,
  }),
  false
)

check(
  "ASQ → usesSharedResultsLayout false",
  usesSharedResultsLayout({
    assessmentCode: "ASQ",
    clientCompletable: false,
    practitionerCompletable: true,
  }),
  false
)

console.log("practitioner-routes.selftest.ts: ok")
