import assert from "node:assert/strict"

import { defaultFundingFormKind } from "@/lib/funding/funding-form-kind"

assert.equal(defaultFundingFormKind({ kindQuery: "referral" }), "referral")
assert.equal(defaultFundingFormKind({ kindQuery: "approval" }), "approval")
assert.equal(defaultFundingFormKind({ kindQuery: "APPROVAL" }), "approval")
assert.equal(defaultFundingFormKind({ kindQuery: null }), "approval")
assert.equal(defaultFundingFormKind({}), "approval")
assert.equal(defaultFundingFormKind({ kindQuery: "other" }), "approval")

assert.equal(
  defaultFundingFormKind({
    isExisting: true,
    fundingApprovalTypeId: "type-1",
  }),
  "approval"
)
assert.equal(
  defaultFundingFormKind({
    isExisting: true,
    fundingApprovalTypeId: null,
  }),
  "referral"
)
assert.equal(
  defaultFundingFormKind({
    isExisting: true,
    fundingApprovalTypeId: "",
  }),
  "referral"
)
// kind query ignored when editing
assert.equal(
  defaultFundingFormKind({
    isExisting: true,
    fundingApprovalTypeId: null,
    kindQuery: "approval",
  }),
  "referral"
)

console.log("funding-form-kind.selftest.ts: ok")
