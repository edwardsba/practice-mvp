import assert from "node:assert/strict"

import {
  anyReferralRecorded,
  buildReferralFundingCardProps,
  referralFundingCardFormOptionKeys,
  referralFundingCardPropKeys,
  type ReferralFundingCardData,
} from "@/lib/funding/referral-funding-card-props"

const sample: ReferralFundingCardData = {
  approvals: [
    {
      fundingApprovalId: "fa1",
      claimId: "c1",
      fundingApprovalTypeId: "t1",
      approvalTypeName: "MHTP Initial",
      claimTypeName: "Medicare",
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      appointmentsApproved: 6,
      appointmentsAttended: 1,
      approvalStatus: "active",
      referrerId: "p1",
      referrerTitle: "Dr",
      referrerFirstName: "Frank",
      referrerLastName: "Doctorson",
      referrerProfessionName: "GP",
      referralDate: "2025-12-01",
      referrerComments: null,
      referralSource: null,
      referrerRelationshipId: null,
      referrerOther: null,
      reportingRequirements: [],
    },
  ],
  clients: [{ clientId: "client-1", firstName: "Tom", lastName: "Example" }],
  approvalTypes: [],
  claims: [],
  privateClaimTypeId: null,
  referrers: [],
  relationships: [],
  professions: [],
  organisations: [],
}

const props = buildReferralFundingCardProps("practice-1", sample)
assert.deepEqual(
  Object.keys(props).sort(),
  [...referralFundingCardPropKeys].sort()
)
assert.deepEqual(
  Object.keys(props.formOptions).sort(),
  [...referralFundingCardFormOptionKeys].sort()
)
assert.equal(props.clientId, "client-1")
assert.equal(props.practiceId, "practice-1")
assert.equal(anyReferralRecorded(sample.approvals), true)
assert.equal(anyReferralRecorded([]), false)

console.log("referral-funding-card.selftest.ts: ok")
