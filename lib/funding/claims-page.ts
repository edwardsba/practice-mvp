/**
 * Pure helpers for the client "Claims, referrals and funding" page
 * and the Client page Referrals and funding quick view.
 */

import { isClaimPeriodActive } from "@/lib/funding/claim-period-active"
import {
  REFERRAL_SOURCE_LABELS,
  type ReferralSource,
} from "@/lib/funding/referral"
import type { ReportingRequirementStatus } from "@/lib/funding/reporting-status"

export type ClaimsPageClaimInput = {
  claimId: string
  claimTypeName: string
  claimTypeCode?: string | null
  isActive: boolean
  startDate: string | null
  endDate: string | null
  createdAt?: string | Date | null
  medicareCardNumber?: string | null
  medicareIrn?: string | null
  medicareExpiry?: string | null
  insuranceOrganisationName?: string | null
  insuranceReferenceNumber?: string | null
}

export type ClaimsPageApprovalInput = {
  fundingApprovalId: string
  claimId: string | null
  fundingApprovalTypeId: string | null
  approvalTypeName: string | null
  startDate: string | null
  endDate: string | null
  referralDate: string | null
  createdAt?: string | Date | null
  appointmentsAttended: number
  appointmentsApproved: number | null
  approvalStatus: string
  referrerId: string | null
  referrerTitle: string | null
  referrerFirstName: string | null
  referrerLastName: string | null
  referrerProfessionName: string | null
  referralSource: string | null
  referrerRelationshipId: string | null
  referrerOther: string | null
  referrerComments: string | null
  reportingRequirements: Array<{
    appointmentNumber: number
    reportType: string
    status: ReportingRequirementStatus
  }>
}

export type ClaimsPageAppointmentInput = {
  fundingApprovalId: string | null
  appointmentDate: string
  status: string
}

export type ApprovalCardKind = "funding_approval" | "referral"

export type ApprovalCardSummary = {
  kind: ApprovalCardKind
  kindLabel: "FUNDING APPROVAL" | "REFERRAL"
  name: string
  headerDetail: string
  usedLine: string | null
}

export type ClaimsPageApprovalModel = ClaimsPageApprovalInput &
  ApprovalCardSummary & {
    reportTag: { kind: "due" | "sent"; label: string } | null
    initiallyOpen: boolean
  }

export type ClaimsPageClaimModel = ClaimsPageClaimInput & {
  sessionsClaimedInYear: number
  calendarYear: number
  approvals: ClaimsPageApprovalModel[]
  closedSummary: string
  initiallyOpen: boolean
  detailRows: Array<{ label: string; value: string }>
}

export type ClaimsPageModel = {
  referralsWithoutClaim: ClaimsPageApprovalModel[]
  activeClaims: ClaimsPageClaimModel[]
  inactiveClaims: ClaimsPageClaimModel[]
  calendarYear: number
}

export type QuickViewLine =
  | {
      kind: "unattached_referral"
      fundingApprovalId: string
      title: string
      subtitle: string
    }
  | {
      kind: "active_claim"
      claimId: string
      fundingApprovalId: string | null
      title: string
      subtitle: string
      reportTag: string | null
    }
  | {
      kind: "inactive_fallback"
      claimId: string
      fundingApprovalId: string | null
      title: string
      subtitle: string
    }
  | {
      kind: "empty"
    }

function createdMs(value: string | Date | null | undefined): number {
  if (!value) return 0
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function asReferralSource(value: string | null | undefined): ReferralSource | null {
  if (!value) return null
  return value === "self" || value === "family_or_friend" || value === "other"
    ? value
    : null
}

/** Calendar year for a yyyy-MM-dd practice-local date string. */
export function calendarYearFromDateString(today: string): number {
  const year = Number(today.slice(0, 4))
  return Number.isFinite(year) ? year : new Date().getFullYear()
}

/**
 * Sessions claimed in the calendar year for one claim.
 * Counts completed appointments linked to any approval in the claim,
 * with appointment_date from 1 Jan of that year through today (inclusive).
 * No yearly limit is applied.
 */
export function countSessionsClaimedInCalendarYear(
  appointments: ClaimsPageAppointmentInput[],
  approvalIds: Iterable<string>,
  today: string
): number {
  const year = calendarYearFromDateString(today)
  const yearStart = `${year}-01-01`
  const idSet = new Set(approvalIds)
  let total = 0
  for (const row of appointments) {
    if (!row.fundingApprovalId || !idSet.has(row.fundingApprovalId)) continue
    if (row.status !== "completed") continue
    if (row.appointmentDate < yearStart) continue
    if (row.appointmentDate > today) continue
    total += 1
  }
  return total
}

/** "N of M used" or "N used" when there is no approved number. */
export function formatSessionsUsedLine(
  used: number,
  approved: number | null | undefined
): string {
  if (approved == null) return `${used} used`
  return `${used} of ${approved} used`
}

export function approvalCardKind(
  approval: Pick<ClaimsPageApprovalInput, "fundingApprovalTypeId">
): ApprovalCardKind {
  return approval.fundingApprovalTypeId ? "funding_approval" : "referral"
}

/** Referrer display name: "Dr Frank Doctorson (GP)". */
export function formatReferrerDisplayName(input: {
  referrerTitle: string | null
  referrerFirstName: string | null
  referrerLastName: string | null
  referrerProfessionName: string | null
}): string | null {
  const first = input.referrerFirstName?.trim()
  if (!first) return null
  const name = [
    input.referrerTitle?.trim(),
    first,
    input.referrerLastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
  const profession = input.referrerProfessionName?.trim()
  if (profession) {
    const short =
      /^general practitioners?$/i.test(profession) || /^g\.?p\.?$/i.test(profession)
        ? "GP"
        : profession
    return `${name} (${short})`
  }
  return name
}

export function buildApprovalCardSummary(
  approval: ClaimsPageApprovalInput,
  formatDate: (value: string | null | undefined) => string = (v) => v ?? "—"
): ApprovalCardSummary {
  const kind = approvalCardKind(approval)
  if (kind === "funding_approval") {
    return {
      kind,
      kindLabel: "FUNDING APPROVAL",
      name: approval.approvalTypeName?.trim() || "Funding approval",
      headerDetail: formatSessionsUsedLine(
        approval.appointmentsAttended,
        approval.appointmentsApproved
      ),
      usedLine: formatSessionsUsedLine(
        approval.appointmentsAttended,
        approval.appointmentsApproved
      ),
    }
  }

  const referrerName = formatReferrerDisplayName(approval)
  const source = asReferralSource(approval.referralSource)
  let name = referrerName
  if (!name && source) {
    name = REFERRAL_SOURCE_LABELS[source]
  }
  if (!name && approval.referrerOther?.trim()) {
    name = approval.referrerOther.trim()
  }
  if (!name) name = "Referral"

  return {
    kind,
    kindLabel: "REFERRAL",
    name,
    headerDetail: approval.referralDate
      ? formatDate(approval.referralDate)
      : "No referral date",
    usedLine: null,
  }
}

/** Newest first: start date, then referral date, then created date. */
export function sortApprovalsForClaimsPage<T extends ClaimsPageApprovalInput>(
  approvals: T[]
): T[] {
  return [...approvals].sort((a, b) => {
    const aStart = a.startDate?.trim() || ""
    const bStart = b.startDate?.trim() || ""
    if (aStart !== bStart) return bStart.localeCompare(aStart)
    const aRef = a.referralDate?.trim() || ""
    const bRef = b.referralDate?.trim() || ""
    if (aRef !== bRef) return bRef.localeCompare(aRef)
    return createdMs(b.createdAt) - createdMs(a.createdAt)
  })
}

/** Newest first: start date, then created date. */
export function sortClaimsNewestFirst<T extends ClaimsPageClaimInput>(
  claims: T[]
): T[] {
  return [...claims].sort((a, b) => {
    const aStart = a.startDate?.trim() || ""
    const bStart = b.startDate?.trim() || ""
    if (aStart !== bStart) return bStart.localeCompare(aStart)
    return createdMs(b.createdAt) - createdMs(a.createdAt)
  })
}

export function maskMedicareLast4(
  cardNumber: string | null | undefined
): string | null {
  const raw = cardNumber?.replace(/\s+/g, "") ?? ""
  if (!raw) return null
  const last4 = raw.slice(-4)
  return `···· ${last4}`
}

export function buildClaimDetailRows(
  claim: ClaimsPageClaimInput,
  formatDate: (value: string | null | undefined) => string
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []
  const masked = maskMedicareLast4(claim.medicareCardNumber)
  if (masked) rows.push({ label: "Medicare card", value: masked })
  const irn = claim.medicareIrn?.trim()
  if (irn) rows.push({ label: "IRN", value: irn })
  const insurer = claim.insuranceOrganisationName?.trim()
  if (insurer) rows.push({ label: "Insurer", value: insurer })
  const ref = claim.insuranceReferenceNumber?.trim()
  if (ref) rows.push({ label: "Reference number", value: ref })
  if (claim.startDate?.trim()) {
    rows.push({ label: "Since", value: formatDate(claim.startDate) })
  }
  if (claim.endDate?.trim()) {
    rows.push({ label: "End date", value: formatDate(claim.endDate) })
  }
  return rows
}

export function nextReportTag(
  requirements: ClaimsPageApprovalInput["reportingRequirements"]
): { kind: "due" | "sent"; label: string } | null {
  if (requirements.length === 0) return null
  const ordered = [...requirements].sort(
    (a, b) => a.appointmentNumber - b.appointmentNumber
  )
  const next = ordered.find((row) => row.status !== "completed")
  if (next) {
    return {
      kind: "due",
      label: `Report due at session ${next.appointmentNumber}`,
    }
  }
  return { kind: "sent", label: "Report sent" }
}

function enrichApproval(
  approval: ClaimsPageApprovalInput,
  initiallyOpen: boolean,
  formatDate: (value: string | null | undefined) => string
): ClaimsPageApprovalModel {
  const summary = buildApprovalCardSummary(approval, formatDate)
  return {
    ...approval,
    ...summary,
    reportTag: nextReportTag(approval.reportingRequirements),
    initiallyOpen,
  }
}

/**
 * Group a client's claims and approvals into the page model:
 * referrals without a claim, active claims, inactive claims;
 * ordering; which cards start open.
 *
 * Soft-deleted claims (`isActive === false`) are excluded.
 * Active/Inactive uses claim end date vs today (not soft-delete).
 */
export function buildClaimsPageModel(
  claims: ClaimsPageClaimInput[],
  approvals: ClaimsPageApprovalInput[],
  appointments: ClaimsPageAppointmentInput[],
  today: string,
  formatDate: (value: string | null | undefined) => string = (v) => v ?? "—"
): ClaimsPageModel {
  const calendarYear = calendarYearFromDateString(today)
  const sortedApprovals = sortApprovalsForClaimsPage(approvals)

  const unattached = sortedApprovals
    .filter((row) => !row.claimId)
    .map((row) => enrichApproval(row, false, formatDate))

  const byClaim = new Map<string, ClaimsPageApprovalInput[]>()
  for (const row of sortedApprovals) {
    if (!row.claimId) continue
    const list = byClaim.get(row.claimId) ?? []
    list.push(row)
    byClaim.set(row.claimId, list)
  }

  function toClaimModel(
    claim: ClaimsPageClaimInput,
    periodActive: boolean,
    initiallyOpen: boolean
  ): ClaimsPageClaimModel {
    const claimApprovals = byClaim.get(claim.claimId) ?? []
    const approvalIds = claimApprovals.map((row) => row.fundingApprovalId)
    const sessionsClaimedInYear = countSessionsClaimedInCalendarYear(
      appointments,
      approvalIds,
      today
    )
    const enriched = claimApprovals.map((row, index) =>
      enrichApproval(row, initiallyOpen && index === 0, formatDate)
    )
    const approvalWord =
      enriched.length === 1 ? "1 approval" : `${enriched.length} approvals`
    return {
      ...claim,
      // Surface period Active/Inactive to the UI (soft-deleted already filtered out).
      isActive: periodActive,
      sessionsClaimedInYear,
      calendarYear,
      approvals: enriched,
      closedSummary: `${approvalWord} · ${sessionsClaimedInYear} claimed in ${calendarYear}`,
      initiallyOpen,
      detailRows: buildClaimDetailRows(claim, formatDate),
    }
  }

  const liveClaims = sortClaimsNewestFirst(
    claims.filter((claim) => claim.isActive)
  )
  const activeClaims = liveClaims
    .filter((claim) => isClaimPeriodActive(claim.endDate, today))
    .map((claim) => toClaimModel(claim, true, true))
  const inactiveClaims = liveClaims
    .filter((claim) => !isClaimPeriodActive(claim.endDate, today))
    .map((claim) => toClaimModel(claim, false, false))

  return {
    referralsWithoutClaim: unattached,
    activeClaims,
    inactiveClaims,
    calendarYear,
  }
}

function newestApprovalName(claim: ClaimsPageClaimModel): string {
  const newest = claim.approvals[0]
  return newest?.name ?? "No referral or approval"
}

function usedAndClaimedSubtitle(claim: ClaimsPageClaimModel): string {
  const newest = claim.approvals[0]
  const used = newest
    ? formatSessionsUsedLine(
        newest.appointmentsAttended,
        newest.appointmentsApproved
      )
    : "0 used"
  return `${used} · ${claim.sessionsClaimedInYear} claimed in ${claim.calendarYear}`
}

function inactiveEndedLabel(
  claim: ClaimsPageClaimModel,
  formatDate: (value: string | null | undefined) => string
): string {
  if (claim.endDate?.trim()) return formatDate(claim.endDate)
  return "—"
}

/**
 * Client page quick-view lines for Referrals and funding.
 * Soft-deleted claims never appear (filtered in buildClaimsPageModel).
 */
export function buildReferralFundingQuickView(
  model: ClaimsPageModel,
  formatDate: (value: string | null | undefined) => string = (v) => v ?? "—"
): QuickViewLine[] {
  const lines: QuickViewLine[] = []

  for (const referral of model.referralsWithoutClaim) {
    lines.push({
      kind: "unattached_referral",
      fundingApprovalId: referral.fundingApprovalId,
      title: "Referral, no claim yet",
      subtitle: [referral.name, referral.headerDetail].filter(Boolean).join(" · "),
    })
  }

  if (model.activeClaims.length > 0) {
    for (const claim of model.activeClaims) {
      const due =
        claim.approvals
          .map((row) => row.reportTag)
          .find((tag) => tag?.kind === "due") ?? null
      lines.push({
        kind: "active_claim",
        claimId: claim.claimId,
        fundingApprovalId: claim.approvals[0]?.fundingApprovalId ?? null,
        title: `${claim.claimTypeName} · ${newestApprovalName(claim)}`,
        subtitle: usedAndClaimedSubtitle(claim),
        reportTag: due?.label ?? null,
      })
    }
    return lines
  }

  const allClaims = [...model.activeClaims, ...model.inactiveClaims]
  if (allClaims.length === 0 && model.referralsWithoutClaim.length === 0) {
    return [{ kind: "empty" }]
  }

  if (allClaims.length === 0) {
    return lines.length > 0 ? lines : [{ kind: "empty" }]
  }

  const mostRecent = sortClaimsNewestFirst(allClaims)[0]
  if (!mostRecent) {
    return lines.length > 0 ? lines : [{ kind: "empty" }]
  }

  const ended = inactiveEndedLabel(mostRecent, formatDate)
  lines.push({
    kind: "inactive_fallback",
    claimId: mostRecent.claimId,
    fundingApprovalId: mostRecent.approvals[0]?.fundingApprovalId ?? null,
    title: mostRecent.claimTypeName,
    subtitle: `Last claim · ended ${ended} · ${mostRecent.sessionsClaimedInYear} claimed in ${mostRecent.calendarYear}`,
  })
  return lines
}
