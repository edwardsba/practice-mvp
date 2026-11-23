import assert from "node:assert/strict"

import {
  approvalCardKind,
  buildApprovalCardSummary,
  buildClaimsPageModel,
  buildReferralFundingQuickView,
  calendarYearFromDateString,
  countSessionsClaimedInCalendarYear,
  formatSessionsUsedLine,
  maskMedicareLast4,
  sortApprovalsForClaimsPage,
  type ClaimsPageApprovalInput,
  type ClaimsPageAppointmentInput,
  type ClaimsPageClaimInput,
} from "@/lib/funding/claims-page"

function approval(
  overrides: Partial<ClaimsPageApprovalInput> & { fundingApprovalId: string }
): ClaimsPageApprovalInput {
  return {
    claimId: null,
    fundingApprovalTypeId: null,
    approvalTypeName: null,
    startDate: null,
    endDate: null,
    referralDate: null,
    createdAt: null,
    appointmentsAttended: 0,
    appointmentsApproved: null,
    approvalStatus: "active",
    referrerId: null,
    referrerTitle: null,
    referrerFirstName: null,
    referrerLastName: null,
    referrerProfessionName: null,
    referralSource: null,
    referrerRelationshipId: null,
    referrerOther: null,
    referrerComments: null,
    reportingRequirements: [],
    ...overrides,
  }
}

function claim(
  overrides: Partial<ClaimsPageClaimInput> & { claimId: string; claimTypeName: string }
): ClaimsPageClaimInput {
  return {
    isActive: true,
    startDate: null,
    endDate: null,
    createdAt: null,
    medicareCardNumber: null,
    medicareIrn: null,
    insuranceOrganisationName: null,
    insuranceReferenceNumber: null,
    ...overrides,
  }
}

// --- Kind and name ---
assert.equal(approvalCardKind({ fundingApprovalTypeId: "t1" }), "funding_approval")
assert.equal(approvalCardKind({ fundingApprovalTypeId: null }), "referral")

const fundingSummary = buildApprovalCardSummary(
  approval({
    fundingApprovalId: "fa1",
    fundingApprovalTypeId: "t1",
    approvalTypeName: "MHTP Review",
    appointmentsAttended: 2,
    appointmentsApproved: 10,
  })
)
assert.equal(fundingSummary.kindLabel, "FUNDING APPROVAL")
assert.equal(fundingSummary.name, "MHTP Review")
assert.equal(fundingSummary.headerDetail, "2 of 10 used")

const referralSummary = buildApprovalCardSummary(
  approval({
    fundingApprovalId: "r1",
    referrerTitle: "Dr",
    referrerFirstName: "Frank",
    referrerLastName: "Doctorson",
    referrerProfessionName: "General Practitioner",
    referralDate: "2026-03-01",
  }),
  (v) => (v === "2026-03-01" ? "1 Mar 2026" : (v ?? "—"))
)
assert.equal(referralSummary.kindLabel, "REFERRAL")
assert.equal(referralSummary.name, "Dr Frank Doctorson (GP)")
assert.equal(referralSummary.headerDetail, "1 Mar 2026")

assert.equal(formatSessionsUsedLine(3, null), "3 used")
assert.equal(formatSessionsUsedLine(3, 6), "3 of 6 used")
assert.equal(maskMedicareLast4("2123456789"), "···· 6789")
assert.equal(maskMedicareLast4("  1234  "), "···· 1234")
assert.equal(maskMedicareLast4(null), null)

// --- Grouping and ordering ---
const claims: ClaimsPageClaimInput[] = [
  claim({
    claimId: "c-medicare",
    claimTypeName: "Medicare",
    isActive: true,
    startDate: "2026-02-01",
    createdAt: "2026-02-01T00:00:00.000Z",
    medicareCardNumber: "2123456789",
    medicareIrn: "1",
  }),
  claim({
    claimId: "c-ndis",
    claimTypeName: "NDIS",
    isActive: true,
    startDate: "2026-01-15",
    createdAt: "2026-01-15T00:00:00.000Z",
  }),
  claim({
    claimId: "c-wc-active",
    claimTypeName: "WorkCover",
    isActive: true,
    startDate: "2025-11-01",
    createdAt: "2025-11-01T00:00:00.000Z",
  }),
  claim({
    claimId: "c-wc-inactive",
    claimTypeName: "WorkCover",
    isActive: false,
    startDate: "2024-06-01",
    endDate: "2025-06-01",
    createdAt: "2024-06-01T00:00:00.000Z",
  }),
]

const approvals: ClaimsPageApprovalInput[] = [
  approval({
    fundingApprovalId: "a-unattached",
    claimId: null,
    referrerFirstName: "Sam",
    referrerLastName: "Referrer",
    referrerTitle: "Dr",
    referrerProfessionName: "GP",
    referralDate: "2026-04-01",
    createdAt: "2026-04-01T00:00:00.000Z",
  }),
  approval({
    fundingApprovalId: "a-medicare-old",
    claimId: "c-medicare",
    fundingApprovalTypeId: "t-initial",
    approvalTypeName: "MHTP Initial",
    startDate: "2026-02-01",
    referralDate: "2026-01-20",
    createdAt: "2026-02-01T00:00:00.000Z",
    appointmentsAttended: 6,
    appointmentsApproved: 6,
  }),
  approval({
    fundingApprovalId: "a-medicare-new",
    claimId: "c-medicare",
    fundingApprovalTypeId: "t-review",
    approvalTypeName: "MHTP Review",
    startDate: "2026-06-01",
    referralDate: "2026-05-15",
    createdAt: "2026-06-01T00:00:00.000Z",
    appointmentsAttended: 1,
    appointmentsApproved: 4,
    reportingRequirements: [
      { appointmentNumber: 4, reportType: "Progress report", status: "not_due" },
    ],
  }),
  approval({
    fundingApprovalId: "a-ndis",
    claimId: "c-ndis",
    fundingApprovalTypeId: "t-ndis",
    approvalTypeName: "NDIS plan",
    startDate: "2026-01-15",
    createdAt: "2026-01-15T00:00:00.000Z",
    appointmentsAttended: 2,
    appointmentsApproved: null,
  }),
]

const appointments: ClaimsPageAppointmentInput[] = [
  {
    fundingApprovalId: "a-medicare-old",
    appointmentDate: "2025-12-31",
    status: "completed",
  },
  {
    fundingApprovalId: "a-medicare-old",
    appointmentDate: "2026-01-01",
    status: "completed",
  },
  {
    fundingApprovalId: "a-medicare-old",
    appointmentDate: "2026-03-01",
    status: "completed",
  },
  {
    fundingApprovalId: "a-medicare-new",
    appointmentDate: "2026-07-01",
    status: "completed",
  },
  {
    fundingApprovalId: "a-medicare-new",
    appointmentDate: "2026-07-02",
    status: "scheduled",
  },
  {
    fundingApprovalId: "a-ndis",
    appointmentDate: "2026-02-01",
    status: "completed",
  },
]

const model = buildClaimsPageModel(
  claims,
  approvals,
  appointments,
  "2026-11-23",
  (v) => v ?? "—"
)

assert.equal(model.referralsWithoutClaim.length, 1)
assert.equal(model.referralsWithoutClaim[0]?.fundingApprovalId, "a-unattached")
assert.equal(model.referralsWithoutClaim[0]?.initiallyOpen, false)

assert.equal(model.activeClaims.length, 3)
assert.deepEqual(
  model.activeClaims.map((row) => row.claimId),
  ["c-medicare", "c-ndis", "c-wc-active"]
)
assert.equal(model.inactiveClaims.length, 1)
assert.equal(model.inactiveClaims[0]?.claimId, "c-wc-inactive")
assert.equal(model.inactiveClaims[0]?.initiallyOpen, false)

// Active claims open; newest approval open inside each
for (const active of model.activeClaims) {
  assert.equal(active.initiallyOpen, true)
  if (active.approvals.length > 0) {
    assert.equal(active.approvals[0]?.initiallyOpen, true)
    for (let i = 1; i < active.approvals.length; i++) {
      assert.equal(active.approvals[i]?.initiallyOpen, false)
    }
  }
}

assert.deepEqual(
  model.activeClaims[0]?.approvals.map((row) => row.fundingApprovalId),
  ["a-medicare-new", "a-medicare-old"]
)

// Medicare: 2025-12-31 excluded; 2026-01-01, 2026-03-01, 2026-07-01 included (3)
assert.equal(model.activeClaims[0]?.sessionsClaimedInYear, 3)
assert.equal(model.activeClaims[0]?.closedSummary, "2 approvals · 3 claimed in 2026")

// --- Year boundaries (Sydney date strings) ---
assert.equal(calendarYearFromDateString("2025-12-31"), 2025)
assert.equal(calendarYearFromDateString("2026-01-01"), 2026)

const medicareIds = ["a-medicare-old", "a-medicare-new"]
assert.equal(
  countSessionsClaimedInCalendarYear(appointments, medicareIds, "2025-12-31"),
  1
)
assert.equal(
  countSessionsClaimedInCalendarYear(appointments, medicareIds, "2026-01-01"),
  1
)
assert.equal(
  countSessionsClaimedInCalendarYear(appointments, medicareIds, "2026-11-23"),
  3
)

// Sort approvals: start, then referral, then created
const sorted = sortApprovalsForClaimsPage([
  approval({
    fundingApprovalId: "s1",
    startDate: "2026-01-01",
    referralDate: "2026-01-02",
    createdAt: "2026-01-03T00:00:00.000Z",
  }),
  approval({
    fundingApprovalId: "s2",
    startDate: "2026-01-01",
    referralDate: "2026-01-05",
    createdAt: "2026-01-01T00:00:00.000Z",
  }),
  approval({
    fundingApprovalId: "s3",
    startDate: "2026-02-01",
    referralDate: null,
    createdAt: "2026-02-01T00:00:00.000Z",
  }),
])
assert.deepEqual(
  sorted.map((row) => row.fundingApprovalId),
  ["s3", "s2", "s1"]
)

// --- Quick view: active claims + unattached ---
const quick = buildReferralFundingQuickView(model, (v) => v ?? "—")
assert.equal(quick[0]?.kind, "unattached_referral")
assert.equal(quick[1]?.kind, "active_claim")
if (quick[1]?.kind === "active_claim") {
  assert.equal(quick[1].title, "Medicare · MHTP Review")
  assert.equal(quick[1].subtitle, "1 of 4 used · 3 claimed in 2026")
  assert.equal(quick[1].reportTag, "Report due at session 4")
}

// --- Quick view: inactive fallback ---
const inactiveOnly = buildClaimsPageModel(
  [
    claim({
      claimId: "old",
      claimTypeName: "Medicare",
      isActive: false,
      startDate: "2024-01-01",
      endDate: "2025-01-01",
      createdAt: "2024-01-01T00:00:00.000Z",
    }),
  ],
  [
    approval({
      fundingApprovalId: "old-a",
      claimId: "old",
      fundingApprovalTypeId: "t1",
      approvalTypeName: "MHTP Initial",
      startDate: "2024-01-01",
      endDate: "2025-01-01",
      appointmentsAttended: 6,
      appointmentsApproved: 6,
    }),
  ],
  [
    {
      fundingApprovalId: "old-a",
      appointmentDate: "2026-02-01",
      status: "completed",
    },
  ],
  "2026-11-23",
  (v) => (v === "2025-01-01" ? "1 Jan 2025" : (v ?? "—"))
)
const inactiveQuick = buildReferralFundingQuickView(inactiveOnly, (v) =>
  v === "2025-01-01" ? "1 Jan 2025" : (v ?? "—")
)
assert.equal(inactiveQuick.length, 1)
assert.equal(inactiveQuick[0]?.kind, "inactive_fallback")
if (inactiveQuick[0]?.kind === "inactive_fallback") {
  assert.equal(inactiveQuick[0].title, "Medicare")
  assert.match(inactiveQuick[0].subtitle, /Last claim · ended 1 Jan 2025/)
  assert.match(inactiveQuick[0].subtitle, /1 claimed in 2026/)
}

// --- Quick view: empty ---
const emptyQuick = buildReferralFundingQuickView(
  buildClaimsPageModel([], [], [], "2026-11-23"),
  (v) => v ?? "—"
)
assert.deepEqual(emptyQuick, [{ kind: "empty" }])

// Several active claims allowed (no single-claim rule)
assert.ok(model.activeClaims.length > 1)

console.log("claims-page.selftest.ts: ok")
