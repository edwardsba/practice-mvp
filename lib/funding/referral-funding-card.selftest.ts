import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  anyReferralRecorded,
  buildReferralFundingCardProps,
  REFERRAL_FUNDING_CARD_EMPTY_MESSAGE,
  referralFundingCardFormOptionKeys,
  referralFundingCardPropKeys,
  type ReferralFundingCardData,
} from "@/lib/funding/referral-funding-card-props"

const componentSource = readFileSync(
  join(process.cwd(), "components/funding/referral-funding-card.tsx"),
  "utf8"
)
assert.match(componentSource, /export function ReferralFundingCard\(/)
assert.ok(REFERRAL_FUNDING_CARD_EMPTY_MESSAGE.includes("private clients"))

const sample: ReferralFundingCardData = {
  approvals: [
    {
      fundingApprovalId: "fa-1",
      claimId: "claim-1",
      fundingApprovalTypeId: "type-1",
      approvalTypeName: "Private (self-funded)",
      claimTypeName: "Private",
      startDate: "2025-01-01",
      endDate: null,
      appointmentsApproved: null,
      appointmentsAttended: 0,
      approvalStatus: "active",
      referrerId: null,
      referrerTitle: null,
      referrerFirstName: null,
      referrerLastName: null,
      referrerProfessionName: null,
      referralDate: null,
      referrerComments: null,
      referralSource: "self",
      referrerRelationshipId: null,
      referrerOther: null,
      reportingRequirements: [],
    },
  ],
  clients: [{ clientId: "client-1", firstName: "Tom", lastName: "Test" }],
  approvalTypes: [],
  claims: [],
  privateClaimTypeId: "private-type",
  referrers: [],
  relationships: [],
  professions: [],
  organisations: [],
}

const clientPageProps = buildReferralFundingCardProps("practice-1", sample)
const backgroundProps = buildReferralFundingCardProps("practice-1", sample)
const interviewProps = buildReferralFundingCardProps("practice-1", sample)

assert.deepEqual(Object.keys(clientPageProps).sort(), [...referralFundingCardPropKeys].sort())
assert.deepEqual(
  Object.keys(clientPageProps.formOptions).sort(),
  [...referralFundingCardFormOptionKeys].sort()
)
assert.deepEqual(clientPageProps, backgroundProps)
assert.deepEqual(backgroundProps, interviewProps)
assert.equal(clientPageProps.clientId, "client-1")
assert.equal(clientPageProps.practiceId, "practice-1")
assert.equal(anyReferralRecorded(clientPageProps.approvals), true)
assert.equal(anyReferralRecorded([{ referrerId: null, referralSource: null }]), false)

console.log("referral-funding-card.selftest.ts: ok")
