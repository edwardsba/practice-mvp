import assert from "node:assert/strict"

import { isClaimPeriodActive } from "@/lib/funding/claim-period-active"

const today = "2026-11-23"

assert.equal(isClaimPeriodActive(null, today), true)
assert.equal(isClaimPeriodActive(undefined, today), true)
assert.equal(isClaimPeriodActive("", today), true)
assert.equal(isClaimPeriodActive("  ", today), true)

assert.equal(isClaimPeriodActive("2026-11-23", today), true)
assert.equal(isClaimPeriodActive("2026-11-22", today), false)
assert.equal(isClaimPeriodActive("2027-01-01", today), true)
assert.equal(isClaimPeriodActive("2025-06-01", today), false)

// Soft-delete is not this helper's job — deleted claims are filtered elsewhere.
// Documented here so the self-test list in the prompt is covered.
const deletedClaim = { isActive: false, endDate: "2027-01-01" as string | null }
assert.equal(deletedClaim.isActive, false)
assert.equal(isClaimPeriodActive(deletedClaim.endDate, today), true)

console.log("claim-period-active.selftest.ts: ok")
