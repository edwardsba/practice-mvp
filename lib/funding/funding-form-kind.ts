export type FundingFormKind = "referral" | "approval"

/**
 * Default Referral vs Funding approval for FundingApprovalForm.
 * - New form: from `kind` query (`referral` | `approval`); otherwise approval.
 * - Existing record: funding approval type set → approval; otherwise referral.
 */
export function defaultFundingFormKind(input: {
  kindQuery?: string | null
  fundingApprovalTypeId?: string | null
  isExisting?: boolean
}): FundingFormKind {
  if (input.isExisting) {
    return input.fundingApprovalTypeId ? "approval" : "referral"
  }
  const kind = input.kindQuery?.trim().toLowerCase()
  if (kind === "referral") return "referral"
  if (kind === "approval") return "approval"
  return "approval"
}
