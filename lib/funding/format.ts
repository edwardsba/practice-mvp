export const APPROVAL_STATUSES = [
  "active",
  "expired",
  "exhausted",
  "cancelled",
] as const

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  active: "Active",
  expired: "Expired",
  exhausted: "Exhausted",
  cancelled: "Cancelled",
}

export type ClaimTypeCode = "medicare" | "ndis" | "insurer"

export function normalizeClaimTypeCode(
  code: string | null | undefined
): ClaimTypeCode | null {
  const value = code?.trim().toLowerCase()
  if (value === "medicare" || value === "ndis" || value === "insurer") return value
  return null
}

/** Code-based helpers — prefer these over display-name checks. */
export function isMedicareClaim(code: string | null | undefined) {
  return normalizeClaimTypeCode(code) === "medicare"
}

export function isNdisClaim(code: string | null | undefined) {
  return normalizeClaimTypeCode(code) === "ndis"
}

export function isInsurerClaim(code: string | null | undefined) {
  return normalizeClaimTypeCode(code) === "insurer"
}

/**
 * Display-only Medicare card grouping: `2123 45670 1` for 10 digits.
 * Spaces/dashes in the input are ignored; short or odd lengths left unchanged.
 */
export function formatMedicareCardNumber(cardNumber: string | null | undefined): string | null {
  const raw = cardNumber?.trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  if (digits.length !== 10) return raw
  return `${digits.slice(0, 4)} ${digits.slice(4, 9)} ${digits.slice(9)}`
}

/**
 * Display helper: "Card 2123 45670 1 · IRN 1" when both are present.
 * Falls back sensibly when only one side is set.
 */
export function formatMedicareCardDisplay(
  cardNumber: string | null | undefined,
  irn: string | null | undefined
): string | null {
  const card = formatMedicareCardNumber(cardNumber)
  const irnValue = irn?.trim() || null
  if (!card && !irnValue) return null
  if (card && irnValue) return `Card ${card} · IRN ${irnValue}`
  if (card) return `Card ${card}`
  return `IRN ${irnValue}`
}

/** @deprecated Prefer formatMedicareCardDisplay for UI. Kept for call sites needing card/irn slash form. */
export function formatMedicareIdentifier(
  cardNumber: string | null | undefined,
  irn: string | null | undefined
) {
  const card = formatMedicareCardNumber(cardNumber) ?? cardNumber?.trim() ?? null
  const irnValue = irn?.trim()
  if (!card && !irnValue) return null
  if (!card) return irnValue ?? null
  if (!irnValue) return card
  return `${card}/${irnValue}`
}

/** Parse MedicareFields month/year selects into YYYY-MM (or null). */
export function parseMedicareExpiryFromForm(formData: FormData): string | null {
  const month = String(formData.get("medicare_expiry_month") ?? "").trim()
  const year = String(formData.get("medicare_expiry_year") ?? "").trim()
  if (!month && !year) return null
  if (!month || !year) return null
  return `${year}-${month.padStart(2, "0")}`
}

/** Format medicare_expiry YYYY-MM for display (e.g. "Mar 2027"). */
export function formatMedicareExpiry(value: string | null | undefined) {
  const raw = value?.trim()
  if (!raw) return null
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) return raw
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return raw
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" })
}

/**
 * Pure uniqueness check: another active claim with the same medicare/ndis code
 * for this client (inactive claims ignored; insurers may repeat).
 */
export function findConflictingActiveMedicareOrNdisClaim(input: {
  clientId: string
  claimId?: string | null
  claimTypeCode: string | null | undefined
  existingActiveClaims: Array<{
    claimId: string
    clientId: string
    isActive: boolean
    claimTypeCode: string | null | undefined
  }>
}): { conflict: true; message: string } | { conflict: false } {
  const code = normalizeClaimTypeCode(input.claimTypeCode)
  if (code !== "medicare" && code !== "ndis") return { conflict: false }
  const other = input.existingActiveClaims.find(
    (claim) =>
      claim.isActive &&
      claim.clientId === input.clientId &&
      claim.claimId !== input.claimId &&
      normalizeClaimTypeCode(claim.claimTypeCode) === code
  )
  if (!other) return { conflict: false }
  return {
    conflict: true,
    message:
      code === "medicare"
        ? "This client already has a Medicare claim."
        : "This client already has an NDIS claim.",
  }
}

export function formatApprovalProgress(attended: number, approved: number | null) {
  if (approved == null) {
    return `${attended}`
  }
  return `${attended}/${approved}`
}

export function formatApprovalDropdownLabel(
  typeName: string,
  attended: number,
  approved: number | null
) {
  return `${typeName} (${formatApprovalProgress(attended, approved)})`
}

export function addMonthsToDateString(
  startDate: string,
  months: number | null | undefined
): string | null {
  if (!startDate || !months) return null
  const date = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value?.trim()) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
