import assert from "node:assert/strict"

import {
  formatCrisisPlanSummary,
  formatEmergencyContactSummary,
} from "@/lib/clients/emergency-details-summary"

assert.equal(formatEmergencyContactSummary([]), "None recorded")

assert.equal(
  formatEmergencyContactSummary([
    { name: "Jordan Example", role: "wife", phone: "0400 111 111" },
  ]),
  "Jordan Example (wife) · 0400 111 111"
)

assert.equal(
  formatEmergencyContactSummary([
    { name: "Jordan Example", role: "wife", phone: "0400 111 111" },
    { name: "Sam Example", role: "brother", phone: "0400 222 222" },
  ]),
  "Jordan Example (wife) · 0400 111 111 · + 1 more"
)

assert.equal(
  formatEmergencyContactSummary([{ name: "Only Name", role: null, phone: null }]),
  "Only Name"
)

assert.equal(formatCrisisPlanSummary(null), "No crisis plan")

assert.equal(
  formatCrisisPlanSummary({ versionNumber: 1, dateOfPlan: "2026-10-05" }),
  "v1 · 5 October 2026"
)

console.log("emergency-details-summary.selftest.ts: ok")
