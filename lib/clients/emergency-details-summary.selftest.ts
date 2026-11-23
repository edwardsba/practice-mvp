import assert from "node:assert/strict"

import {
  formatCrisisPlanSummary,
  formatEmergencyContactSummary,
} from "@/lib/clients/emergency-details-summary"

assert.equal(formatEmergencyContactSummary([]), "None recorded")

assert.equal(
  formatEmergencyContactSummary([
    {
      name: "Jordan Example",
      role: "wife",
      phone: "0400 111 111",
      email: "jordan@example.com",
    },
  ]),
  "Jordan Example (wife) · 0400 111 111 · jordan@example.com"
)

assert.equal(
  formatEmergencyContactSummary([
    {
      name: "Jordan Example",
      role: "wife",
      phone: "0400 111 111",
      email: "jordan@example.com",
    },
    {
      name: "Sam Example",
      role: "brother",
      phone: "0400 222 222",
      email: null,
    },
  ]),
  [
    "Jordan Example (wife) · 0400 111 111 · jordan@example.com",
    "Sam Example (brother) · 0400 222 222",
  ].join("\n")
)

assert.equal(
  formatEmergencyContactSummary([
    { name: "Only Name", role: null, phone: null, email: null },
  ]),
  "Only Name"
)

assert.equal(
  formatEmergencyContactSummary([
    { name: "No Phone", role: "friend", phone: null, email: "a@b.com" },
  ]),
  "No Phone (friend) · a@b.com"
)

assert.equal(
  formatEmergencyContactSummary([
    { name: "No Email", role: null, phone: "0400 000 000", email: null },
  ]),
  "No Email · 0400 000 000"
)

assert.equal(formatCrisisPlanSummary(null), "No crisis plan")

assert.equal(
  formatCrisisPlanSummary({ versionNumber: 1, dateOfPlan: "2026-10-05" }),
  "v1 · 5 October 2026"
)

console.log("emergency-details-summary.selftest.ts: ok")
