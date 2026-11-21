import type { ReportingRequirementStatus } from "@/lib/funding/reporting-status"
import { hasReferralRecorded, type ReferralSource } from "@/lib/funding/referral"

export const REFERRAL_FUNDING_CARD_EMPTY_MESSAGE =
  "No funding approval yet. Every client needs one, even private clients."

export type ReferralFundingApprovalRow = {
  fundingApprovalId: string
  claimId: string | null
  fundingApprovalTypeId: string | null
  approvalTypeName: string | null
  claimTypeName: string | null
  startDate: string | null
  endDate: string | null
  appointmentsApproved: number | null
  appointmentsAttended: number
  approvalStatus: string
  referrerId: string | null
  referrerTitle: string | null
  referrerFirstName: string | null
  referrerLastName: string | null
  referrerProfessionName: string | null
  referralDate: string | null
  referrerComments: string | null
  referralSource: ReferralSource | string | null
  referrerRelationshipId: string | null
  referrerOther: string | null
  reportingRequirements: Array<{
    appointmentNumber: number
    reportType: string
    status: ReportingRequirementStatus
  }>
  createdAt?: string | Date | null
}

export type ReferralFundingCardRelationship = {
  relationshipRecordId: string
  givenName: string
  relationshipToClient: string
  blockRole: string | null
  blockRoleType: string | null
}

export type ReferralFundingCardReferrer = {
  professionalId: string
  title: string | null
  firstName: string
  lastName: string
  professionName: string | null
  organisationName: string | null
}

export type ReferralFundingCardApprovalType = {
  fundingApprovalTypeId: string
  name: string
  claimTypeId: string | null
  durationMonths: number | null
  appointmentsApproved: number | null
  reports: Array<{ appointmentNumber: number; reportType: string }>
}

export type ReferralFundingCardClaim = {
  claimId: string
  claimTypeId: string | null
  claimTypeName: string
  startDate: string | null
}

export type ReferralFundingCardData = {
  approvals: ReferralFundingApprovalRow[]
  clients: Array<{ clientId: string; firstName: string; lastName: string }>
  approvalTypes: ReferralFundingCardApprovalType[]
  claims: ReferralFundingCardClaim[]
  privateClaimTypeId: string | null
  referrers: ReferralFundingCardReferrer[]
  relationships: ReferralFundingCardRelationship[]
  professions: Array<{ professionId: string; professionName: string }>
  organisations: Array<{ organisationId: string; organisationName: string }>
}

export type ReferralFundingCardFormOptions = {
  approvalTypes: ReferralFundingCardApprovalType[]
  claims: ReferralFundingCardClaim[]
  privateClaimTypeId: string | null
  referrers: ReferralFundingCardReferrer[]
  relationships: ReferralFundingCardRelationship[]
  professions: Array<{ professionId: string; professionName: string }>
  organisations: Array<{ organisationId: string; organisationName: string }>
  client: { clientId: string; firstName: string; lastName: string }
}

export type ReferralFundingCardProps = {
  clientId: string
  practiceId: string
  approvals: ReferralFundingApprovalRow[]
  formOptions: ReferralFundingCardFormOptions
}

/** Stable keys for self-tests that client / background / interview share the same shape. */
export const referralFundingCardPropKeys = [
  "clientId",
  "practiceId",
  "approvals",
  "formOptions",
] as const

export const referralFundingCardFormOptionKeys = [
  "approvalTypes",
  "claims",
  "privateClaimTypeId",
  "referrers",
  "relationships",
  "professions",
  "organisations",
  "client",
] as const

export function buildReferralFundingCardProps(
  practiceId: string,
  data: ReferralFundingCardData
): ReferralFundingCardProps {
  const client = data.clients[0]
  if (!client) {
    throw new Error("Referral funding card data requires the client.")
  }

  return {
    clientId: client.clientId,
    practiceId,
    approvals: data.approvals,
    formOptions: {
      approvalTypes: data.approvalTypes,
      claims: data.claims,
      privateClaimTypeId: data.privateClaimTypeId,
      referrers: data.referrers,
      relationships: data.relationships,
      professions: data.professions,
      organisations: data.organisations,
      client,
    },
  }
}

/** True when any approval records a referrer or referral source. */
export function anyReferralRecorded(
  approvals: Array<Pick<ReferralFundingApprovalRow, "referrerId" | "referralSource">>
) {
  return approvals.some((row) => hasReferralRecorded(row))
}
