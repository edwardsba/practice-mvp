/** Referral fields on a funding approval, and helpers for the card / report. */

export const REFERRAL_SOURCES = ["self", "family_or_friend", "other"] as const
export type ReferralSource = (typeof REFERRAL_SOURCES)[number]

export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, string> = {
  self: "Self-referral",
  family_or_friend: "Family or friend",
  other: "Other",
}

export const PRIVATE_CLAIM_TYPE_NAME = "Private"
export const PRIVATE_APPROVAL_TYPE_NAME = "Private (self-funded)"
/** Sentinel claim id when the client has no Private claim yet — created on save. */
export const CREATE_PRIVATE_CLAIM = "__create_private__"

export type FundingReferralFields = {
  referrerId: string | null
  referralDate: string | null
  referrerComments: string | null
  referralSource: ReferralSource | null
  referrerRelationshipId: string | null
  referrerOther: string | null
}

export type ApprovalForReportPick = {
  fundingApprovalId: string
  startDate: string | null
  endDate: string | null
  createdAt?: string | Date | null
}

/**
 * Approval active on the interview date (start ≤ date ≤ end, or open-ended),
 * else the most recent by start date then createdAt.
 */
export function pickApprovalForReportDate<T extends ApprovalForReportPick>(
  approvals: T[],
  interviewDate: string | null | undefined
): T | null {
  if (approvals.length === 0) return null
  const date = interviewDate?.trim() || null
  if (date) {
    const active = approvals.filter((row) => {
      const start = row.startDate?.trim() || null
      const end = row.endDate?.trim() || null
      if (start && start > date) return false
      if (end && end < date) return false
      return Boolean(start) || !end
    })
    if (active.length === 1) return active[0]
    if (active.length > 1) return sortApprovalsMostRecent(active)[0]
  }
  return sortApprovalsMostRecent(approvals)[0]
}

export function sortApprovalsMostRecent<T extends ApprovalForReportPick>(approvals: T[]): T[] {
  return [...approvals].sort((a, b) => {
    const aStart = a.startDate?.trim() || ""
    const bStart = b.startDate?.trim() || ""
    if (aStart !== bStart) return bStart.localeCompare(aStart)
    const aCreated = createdMs(a.createdAt)
    const bCreated = createdMs(b.createdAt)
    return bCreated - aCreated
  })
}

function createdMs(value: string | Date | null | undefined): number {
  if (!value) return 0
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

/** Band progress text: "{n} of {m} attended" or "{n} attended" when unlimited. */
export function formatAttendedBand(attended: number, approved: number | null | undefined): string {
  if (approved == null) return `${attended} attended`
  return `${attended} of ${approved} attended`
}

export type ReferralCardReferrer = {
  title: string | null
  firstName: string
  lastName: string
  professionName: string | null
}

export type ReferralCardWho = {
  givenName: string
  roleLabel: string
}

export type ReferralCardBodyInput = {
  referrer: ReferralCardReferrer | null
  referralSource: ReferralSource | null
  who: ReferralCardWho | null
  referrerOther: string | null
  referralDate: string | null
  referrerComments: string | null
  formatDate: (value: string | null | undefined) => string
}

export type ReferralCardBodyLine = { label: string; value: string }

/** Body lines for the card: only filled fields. */
export function referralCardBodyLines(input: ReferralCardBodyInput): ReferralCardBodyLine[] {
  const lines: ReferralCardBodyLine[] = []
  if (input.referrer) {
    const name = [
      input.referrer.title?.trim(),
      input.referrer.firstName.trim(),
      input.referrer.lastName.trim(),
    ]
      .filter(Boolean)
      .join(" ")
    const profession = input.referrer.professionName?.trim()
    lines.push({
      label: "Referrer",
      value: profession ? `${name}, ${profession}` : name,
    })
  } else {
    if (input.referralSource) {
      lines.push({
        label: "Referral source",
        value: REFERRAL_SOURCE_LABELS[input.referralSource],
      })
    }
    if (input.referralSource === "family_or_friend") {
      if (input.who) {
        const name = input.who.givenName.trim() || "Unnamed"
        lines.push({
          label: "Who",
          value: input.who.roleLabel ? `${name} (${input.who.roleLabel})` : name,
        })
      } else if (input.referrerOther?.trim()) {
        lines.push({ label: "Who", value: input.referrerOther.trim() })
      }
    } else if (input.referralSource === "other" && input.referrerOther?.trim()) {
      lines.push({ label: "Who", value: input.referrerOther.trim() })
    }
  }
  if (input.referralDate?.trim()) {
    lines.push({ label: "Referral date", value: input.formatDate(input.referralDate) })
  }
  if (input.referrerComments?.trim()) {
    lines.push({ label: "Referrer comments", value: input.referrerComments.trim() })
  }
  return lines
}

/** True when Private should be offered even if the client has no Private claim row yet. */
export function claimOptionsWithPrivateFirst<
  T extends { claimId: string; claimTypeName: string },
>(claims: T[], privateClaimTypeId: string | null): Array<T | { claimId: typeof CREATE_PRIVATE_CLAIM; claimTypeName: typeof PRIVATE_CLAIM_TYPE_NAME; claimTypeId: string | null; isVirtualPrivate: true }> {
  const privateClaim = claims.find(
    (claim) => claim.claimTypeName.trim().toLowerCase() === PRIVATE_CLAIM_TYPE_NAME.toLowerCase()
  )
  const others = claims.filter(
    (claim) => claim.claimTypeName.trim().toLowerCase() !== PRIVATE_CLAIM_TYPE_NAME.toLowerCase()
  )
  if (privateClaim) {
    return [privateClaim, ...others]
  }
  return [
    {
      claimId: CREATE_PRIVATE_CLAIM,
      claimTypeName: PRIVATE_CLAIM_TYPE_NAME,
      claimTypeId: privateClaimTypeId,
      isVirtualPrivate: true as const,
    },
    ...others,
  ]
}

/** When Private is chosen, auto-fill Private (self-funded) if that type exists. */
export function privateApprovalTypeId(
  approvalTypes: Array<{ fundingApprovalTypeId: string; name: string; claimTypeId: string | null }>,
  privateClaimTypeId: string | null
): string | null {
  const match = approvalTypes.find(
    (type) =>
      type.name.trim() === PRIVATE_APPROVAL_TYPE_NAME &&
      (privateClaimTypeId == null || type.claimTypeId === privateClaimTypeId)
  )
  return match?.fundingApprovalTypeId ?? null
}

export function isPrivateClaimSelection(
  claimId: string | null | undefined,
  claims: Array<{ claimId: string; claimTypeName: string }>
): boolean {
  if (!claimId) return false
  if (claimId === CREATE_PRIVATE_CLAIM) return true
  const claim = claims.find((row) => row.claimId === claimId)
  return claim?.claimTypeName.trim().toLowerCase() === PRIVATE_CLAIM_TYPE_NAME.toLowerCase()
}

/** Whether referral info is present enough that Worth checking should stay quiet. */
export function hasReferralRecorded(fields: {
  referrerId?: string | null
  referralSource?: string | null
}): boolean {
  return Boolean(fields.referrerId?.trim() || fields.referralSource?.trim())
}

/** JSON keys that must not be read outside the 0075 migration after this round. */
export const RETIRED_REASON_REFERRAL_KEYS = [
  "referralType",
  "referrerProfessionalId",
  "referralDate",
  "referrerConcerns",
  "referrerRelationshipId",
  "referrerIsOther",
  "referrerOther",
  "theirConcerns",
] as const
