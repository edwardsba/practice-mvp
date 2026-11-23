/**
 * Active vs Inactive for a non-deleted claim (Australia/Sydney date strings).
 * Soft-delete (`claims.is_active = false`) is separate — callers must hide those.
 *
 * Active: no end date, or end date today or later.
 * Inactive: end date before today.
 * Approvals do not affect this.
 */
export function isClaimPeriodActive(
  endDate: string | null | undefined,
  today: string
): boolean {
  const end = endDate?.trim()
  if (!end) return true
  return end >= today
}
