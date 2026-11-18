import assert from "node:assert/strict"

import {
  chooseLegacyApprovalKind,
  claimOptionsWithPrivateFirst,
  CREATE_PRIVATE_CLAIM,
  formatAttendedBand,
  hasReferralRecorded,
  moveLegacyReferralOntoApproval,
  pickApprovalForReportDate,
  privateApprovalTypeId,
  PRIVATE_APPROVAL_TYPE_NAME,
  PRIVATE_CLAIM_TYPE_NAME,
  referralCardBodyLines,
} from "@/lib/funding/referral"

const privateTypeId = "private-type"
const medicareTypeId = "medicare-type"

const approvalTypes = [
  {
    fundingApprovalTypeId: "private-approval",
    name: PRIVATE_APPROVAL_TYPE_NAME,
    claimTypeId: privateTypeId,
  },
  {
    fundingApprovalTypeId: "mhtp",
    name: "MHTP Initial",
    claimTypeId: medicareTypeId,
  },
]

const claims = [
  {
    claimId: "medicare-1",
    claimTypeId: medicareTypeId,
    claimTypeName: "Medicare",
  },
]

const withVirtualPrivate = claimOptionsWithPrivateFirst(claims, privateTypeId)
assert.equal(withVirtualPrivate[0]?.claimId, CREATE_PRIVATE_CLAIM)
assert.equal(withVirtualPrivate[0]?.claimTypeName, PRIVATE_CLAIM_TYPE_NAME)
assert.equal(withVirtualPrivate[1]?.claimId, "medicare-1")

const filledPrivateId = privateApprovalTypeId(approvalTypes, privateTypeId)
assert.equal(filledPrivateId, "private-approval")

const claimsWithPrivate = [
  {
    claimId: "private-1",
    claimTypeId: privateTypeId,
    claimTypeName: PRIVATE_CLAIM_TYPE_NAME,
  },
  ...claims,
]
const privateFirst = claimOptionsWithPrivateFirst(claimsWithPrivate, privateTypeId)
assert.equal(privateFirst[0]?.claimId, "private-1")
assert.equal(privateFirst.length, 2)

const approvals = [
  {
    fundingApprovalId: "old",
    startDate: "2024-01-01",
    endDate: "2024-06-30",
    createdAt: "2024-01-02T00:00:00.000Z",
  },
  {
    fundingApprovalId: "active",
    startDate: "2024-07-01",
    endDate: "2024-12-31",
    createdAt: "2024-07-02T00:00:00.000Z",
  },
  {
    fundingApprovalId: "newer-open",
    startDate: "2025-01-01",
    endDate: null,
    createdAt: "2025-01-02T00:00:00.000Z",
  },
]

assert.equal(
  pickApprovalForReportDate(approvals, "2024-08-15")?.fundingApprovalId,
  "active"
)
assert.equal(
  pickApprovalForReportDate(approvals, "2025-03-01")?.fundingApprovalId,
  "newer-open"
)
assert.equal(
  pickApprovalForReportDate(approvals, null)?.fundingApprovalId,
  "newer-open"
)

const empty = {
  referrerId: null,
  referralDate: null,
  referrerComments: null,
  referralSource: null,
  referrerRelationshipId: null,
  referrerOther: null,
}

const medical = moveLegacyReferralOntoApproval(
  {
    referralType: "medical",
    referrerProfessionalId: "pro-1",
    referralDate: "2024-05-01",
    referrerConcerns: "Anxiety",
  },
  empty
)
assert.equal(medical.referrerId, "pro-1")
assert.equal(medical.referralDate, "2024-05-01")
assert.equal(medical.referrerComments, "Anxiety")

const family = moveLegacyReferralOntoApproval(
  {
    referralType: "family_or_friend",
    referrerRelationshipId: "rel-1",
    theirConcerns: "Worried",
    referralDate: "2024-04",
  },
  empty
)
assert.equal(family.referralSource, "family_or_friend")
assert.equal(family.referrerRelationshipId, "rel-1")
assert.equal(family.referrerComments, "Worried")
assert.equal(family.referralDate, null)

const self = moveLegacyReferralOntoApproval({ referralType: "self" }, empty)
assert.equal(self.referralSource, "self")

assert.equal(
  chooseLegacyApprovalKind({
    referralType: "medical",
    referrerProfessionalId: "pro-1",
  }),
  "mhtp_initial"
)
assert.equal(
  chooseLegacyApprovalKind({ referralType: "medical", referrerProfessionalId: null }),
  "private"
)
assert.equal(chooseLegacyApprovalKind({ referralType: "self" }), "private")

const medicalPartialDate = moveLegacyReferralOntoApproval(
  {
    referralType: "medical",
    referrerProfessionalId: "pro-2",
    referralDate: "2024",
    referrerConcerns: "Mood",
  },
  empty
)
assert.equal(medicalPartialDate.referrerId, "pro-2")
assert.equal(medicalPartialDate.referralDate, null)
assert.equal(medicalPartialDate.referrerComments, "Mood")

const withReferrer = referralCardBodyLines({
  referrer: {
    title: "Dr",
    firstName: "Jane",
    lastName: "Smith",
    professionName: "GP",
  },
  referralSource: "self",
  who: null,
  referrerOther: "ignored",
  referralDate: "2024-05-01",
  referrerComments: "Please review",
  formatDate: (value) => value ?? "",
})
assert.deepEqual(
  withReferrer.map((line) => line.label),
  ["Referrer", "Referral date", "Referrer comments"]
)
assert.equal(withReferrer[0]?.value, "Dr Jane Smith, GP")

const withoutReferrer = referralCardBodyLines({
  referrer: null,
  referralSource: "family_or_friend",
  who: { givenName: "Sam", roleLabel: "Parent" },
  referrerOther: null,
  referralDate: null,
  referrerComments: null,
  formatDate: (value) => value ?? "",
})
assert.deepEqual(
  withoutReferrer.map((line) => line.label),
  ["Referral source", "Who"]
)
assert.equal(withoutReferrer[1]?.value, "Sam (Parent)")

assert.equal(formatAttendedBand(3, 10), "3 of 10 attended")
assert.equal(formatAttendedBand(2, null), "2 attended")
assert.equal(hasReferralRecorded({ referrerId: "x" }), true)
assert.equal(hasReferralRecorded({ referralSource: "self" }), true)
assert.equal(hasReferralRecorded({}), false)

console.log("referral.selftest.ts: ok")
