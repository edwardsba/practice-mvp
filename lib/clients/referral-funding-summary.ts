import {
  formatAttendedBand,
  referralCardBodyLines,
  REFERRAL_SOURCES,
  sortApprovalsMostRecent,
  type ReferralSource,
} from "@/lib/funding/referral"
import type { ReferralFundingApprovalRow } from "@/lib/funding/referral-funding-card-props"
import type { ReportingRequirementStatus } from "@/lib/funding/reporting-status"

export type ReferralFundingSummaryApproval = Pick<
  ReferralFundingApprovalRow,
  | "fundingApprovalId"
  | "approvalTypeName"
  | "claimTypeName"
  | "appointmentsAttended"
  | "appointmentsApproved"
  | "approvalStatus"
  | "startDate"
  | "endDate"
  | "createdAt"
  | "referrerId"
  | "referrerTitle"
  | "referrerFirstName"
  | "referrerLastName"
  | "referrerProfessionName"
  | "referralSource"
  | "referrerRelationshipId"
  | "referrerOther"
  | "referralDate"
  | "referrerComments"
  | "reportingRequirements"
>

export type ReferralFundingSummaryRelationship = {
  relationshipRecordId: string
  givenName: string
  relationshipToClient: string
}

export type DueReportChip = {
  appointmentNumber: number
  reportType: string
  status: ReportingRequirementStatus
}

export type ReferralFundingPanelSummary = {
  approvalLine: string | null
  approvalStatus: string | null
  referrerLabel: string | null
  referrerValue: string | null
  dueReports: DueReportChip[]
}

function asReferralSource(
  value: string | null | undefined
): ReferralSource | null {
  if (!value) return null
  return (REFERRAL_SOURCES as readonly string[]).includes(value)
    ? (value as ReferralSource)
    : null
}

/** Prefer an active approval; otherwise the most recent by start/created. */
export function pickCurrentFundingApproval<T extends ReferralFundingSummaryApproval>(
  approvals: T[]
): T | null {
  if (approvals.length === 0) return null
  const active = approvals.filter((row) => row.approvalStatus === "active")
  if (active.length === 1) return active[0]
  if (active.length > 1) return sortApprovalsMostRecent(active)[0]
  return sortApprovalsMostRecent(approvals)[0]
}

/**
 * Collapsed Referrals and funding summary from the same approval rows the card uses.
 */
export function buildReferralFundingPanelSummary(
  approvals: ReferralFundingSummaryApproval[],
  relationships: ReferralFundingSummaryRelationship[],
  formatDate: (value: string | null | undefined) => string = (v) => v ?? "—"
): ReferralFundingPanelSummary {
  const approval = pickCurrentFundingApproval(approvals)
  if (!approval) {
    return {
      approvalLine: null,
      approvalStatus: null,
      referrerLabel: null,
      referrerValue: null,
      dueReports: [],
    }
  }

  const type = approval.approvalTypeName?.trim() || "Funding approval"
  const funder = approval.claimTypeName?.trim() || "—"
  const attended = formatAttendedBand(
    approval.appointmentsAttended,
    approval.appointmentsApproved
  )
  const approvalLine = `${type} · ${funder} · ${attended}`

  const referrer =
    approval.referrerId && approval.referrerFirstName
      ? {
          title: approval.referrerTitle,
          firstName: approval.referrerFirstName,
          lastName: approval.referrerLastName ?? "",
          professionName: approval.referrerProfessionName,
        }
      : null

  const whoRecord = approval.referrerRelationshipId
    ? relationships.find(
        (row) => row.relationshipRecordId === approval.referrerRelationshipId
      )
    : null

  const lines = referralCardBodyLines({
    referrer,
    referralSource: asReferralSource(approval.referralSource),
    who: whoRecord
      ? {
          givenName: whoRecord.givenName,
          roleLabel: whoRecord.relationshipToClient,
        }
      : null,
    referrerOther: approval.referrerOther,
    referralDate: approval.referralDate,
    referrerComments: approval.referrerComments,
    formatDate,
  })

  const referrerLine =
    lines.find((line) => line.label === "Referrer") ??
    lines.find((line) => line.label === "Referral source") ??
    null

  const dueReports = approval.reportingRequirements.filter(
    (req) => req.status === "overdue"
  )

  return {
    approvalLine,
    approvalStatus: approval.approvalStatus,
    referrerLabel: referrerLine?.label ?? null,
    referrerValue: referrerLine?.value ?? null,
    dueReports,
  }
}
