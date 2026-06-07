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

export function isMedicareClaimType(claimTypeName: string | null | undefined) {
  return claimTypeName?.trim().toLowerCase() === "medicare"
}

export function formatMedicareIdentifier(
  cardNumber: string | null | undefined,
  irn: string | null | undefined
) {
  const card = cardNumber?.trim()
  const irnValue = irn?.trim()
  if (!card && !irnValue) return null
  if (!card) return irnValue ?? null
  if (!irnValue) return card
  return `${card}/${irnValue}`
}

export function isInsuranceClaimType(claimTypeName: string | null | undefined) {
  if (!claimTypeName?.trim()) return false
  return !isMedicareClaimType(claimTypeName)
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
