import assert from "node:assert/strict"

import { usesSharedPractitionerForm } from "@/lib/assessments/practitioner-routes"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check(
  "LRAMP → true",
  usesSharedPractitionerForm({
    assessmentCode: "LRAMP",
    clientCompletable: false,
    practitionerCompletable: true,
  }),
  true
)

check(
  "ASQ → false (legacy)",
  usesSharedPractitionerForm({
    assessmentCode: "ASQ",
    clientCompletable: false,
    practitionerCompletable: true,
  }),
  false
)

check(
  "mse → false (legacy)",
  usesSharedPractitionerForm({
    assessmentCode: "mse",
    clientCompletable: false,
    practitionerCompletable: true,
  }),
  false
)

check(
  "PHQ9 (client and practitioner completable) → false",
  usesSharedPractitionerForm({
    assessmentCode: "PHQ9",
    clientCompletable: true,
    practitionerCompletable: true,
  }),
  false
)

check(
  "made-up practitioner-only code → true",
  usesSharedPractitionerForm({
    assessmentCode: "CUSTOM_RISK",
    clientCompletable: false,
    practitionerCompletable: true,
  }),
  true
)

check(
  "not practitioner-completable → false",
  usesSharedPractitionerForm({
    assessmentCode: "CUSTOM_RISK",
    clientCompletable: false,
    practitionerCompletable: false,
  }),
  false
)

console.log("practitioner-routes.selftest.ts: ok")
