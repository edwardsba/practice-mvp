import assert from "node:assert/strict"

import {
  buildReferralFundingPanelSummary,
  pickCurrentFundingApproval,
} from "@/lib/clients/referral-funding-summary"
import type { ReferralFundingSummaryApproval } from "@/lib/clients/referral-funding-summary"

const empty = buildReferralFundingPanelSummary([], [])
assert.equal(empty.approvalLine, null)
assert.deepEqual(empty.dueReports, [])

const sample: ReferralFundingSummaryApproval = {
  fundingApprovalId: "a1",
  approvalTypeName: "MHTP Initial",
  claimTypeName: "Medicare",
  appointmentsAttended: 1,
  appointmentsApproved: 6,
  approvalStatus: "active",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  createdAt: "2026-01-01T00:00:00.000Z",
  referrerId: "r1",
  referrerTitle: "Dr",
  referrerFirstName: "Harry",
  referrerLastName: "TestDoc",
  referrerProfessionName: "GP",
  referralSource: null,
  referrerRelationshipId: null,
  referrerOther: null,
  referralDate: "2026-01-02",
  referrerComments: null,
  reportingRequirements: [
    {
      appointmentNumber: 5,
      reportType: "Progress report",
      status: "overdue",
    },
    {
      appointmentNumber: 10,
      reportType: "Progress report",
      status: "not_due",
    },
  ],
}

const summary = buildReferralFundingPanelSummary([sample], [])
assert.equal(summary.approvalLine, "MHTP Initial · Medicare · 1 of 6 attended")
assert.equal(summary.approvalStatus, "active")
assert.equal(summary.referrerLabel, "Referrer")
assert.equal(summary.referrerValue, "Dr Harry TestDoc, GP")
assert.equal(summary.dueReports.length, 1)
assert.equal(summary.dueReports[0]?.appointmentNumber, 5)

const expired: ReferralFundingSummaryApproval = {
  ...sample,
  fundingApprovalId: "a0",
  approvalStatus: "expired",
  startDate: "2025-01-01",
}
assert.equal(
  pickCurrentFundingApproval([expired, sample])?.fundingApprovalId,
  "a1"
)

const selfReferral: ReferralFundingSummaryApproval = {
  ...sample,
  referrerId: null,
  referrerTitle: null,
  referrerFirstName: null,
  referrerLastName: null,
  referrerProfessionName: null,
  referralSource: "self",
  reportingRequirements: [],
}
const selfSummary = buildReferralFundingPanelSummary([selfReferral], [])
assert.equal(selfSummary.referrerLabel, "Referral source")
assert.equal(selfSummary.referrerValue, "Self-referral")

console.log("referral-funding-summary.selftest.ts: ok")
