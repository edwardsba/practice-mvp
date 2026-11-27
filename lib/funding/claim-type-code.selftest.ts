import assert from "node:assert/strict"

import {
  findConflictingActiveMedicareOrNdisClaim,
  isInsurerClaim,
  isMedicareClaim,
  isNdisClaim,
} from "@/lib/funding/format"

assert.equal(isMedicareClaim("medicare"), true)
assert.equal(isMedicareClaim("Medicare"), true)
assert.equal(isMedicareClaim("ndis"), false)
assert.equal(isNdisClaim("ndis"), true)
assert.equal(isInsurerClaim("insurer"), true)
assert.equal(isInsurerClaim("medicare"), false)

const clientId = "client-1"
const existing = [
  {
    claimId: "c-med",
    clientId,
    isActive: true,
    claimTypeCode: "medicare",
  },
  {
    claimId: "c-ndis",
    clientId,
    isActive: true,
    claimTypeCode: "ndis",
  },
  {
    claimId: "c-ins-1",
    clientId,
    isActive: true,
    claimTypeCode: "insurer",
  },
  {
    claimId: "c-med-inactive",
    clientId,
    isActive: false,
    claimTypeCode: "medicare",
  },
]

assert.deepEqual(
  findConflictingActiveMedicareOrNdisClaim({
    clientId,
    claimTypeCode: "medicare",
    existingActiveClaims: existing,
  }),
  { conflict: true, message: "This client already has a Medicare claim." }
)

assert.deepEqual(
  findConflictingActiveMedicareOrNdisClaim({
    clientId,
    claimId: "c-med",
    claimTypeCode: "medicare",
    existingActiveClaims: existing,
  }),
  { conflict: false }
)

assert.deepEqual(
  findConflictingActiveMedicareOrNdisClaim({
    clientId,
    claimTypeCode: "ndis",
    existingActiveClaims: existing,
  }),
  { conflict: true, message: "This client already has an NDIS claim." }
)

assert.deepEqual(
  findConflictingActiveMedicareOrNdisClaim({
    clientId,
    claimTypeCode: "insurer",
    existingActiveClaims: existing,
  }),
  { conflict: false }
)

assert.deepEqual(
  findConflictingActiveMedicareOrNdisClaim({
    clientId,
    claimTypeCode: "medicare",
    existingActiveClaims: existing.filter((c) => c.isActive === false || c.claimTypeCode !== "medicare"),
  }),
  { conflict: false }
)

console.log("claim-type-code.selftest.ts: ok")
