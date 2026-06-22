const DRAFT_KEY_PREFIX = "funding-approval-draft:"

export type FundingApprovalDraft = {
  clientId: string
  approvalTypeId: string
  claimId: string
  referrerId: string
  startDate: string
  endDate: string
  appointmentsApproved: string
  reportLinks: Array<{
    appointmentNumber: number
    reportType: string
    simpleReportId: string | null
  }>
}

function draftKey(id: string | "new") {
  return `${DRAFT_KEY_PREFIX}${id}`
}

export function saveFundingApprovalDraft(
  id: string | "new",
  draft: FundingApprovalDraft
): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(draftKey(id), JSON.stringify(draft))
}

export function loadFundingApprovalDraft(
  id: string | "new"
): FundingApprovalDraft | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(draftKey(id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as FundingApprovalDraft
  } catch {
    return null
  }
}

export function clearFundingApprovalDraft(id: string | "new"): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(draftKey(id))
}
