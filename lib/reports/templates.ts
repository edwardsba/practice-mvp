export const REPORT_TEMPLATE_KEYS = [
  "progress_report",
  "referral_acknowledgement",
] as const

export type ReportTemplateKey = (typeof REPORT_TEMPLATE_KEYS)[number]

export const REPORT_TEMPLATE_LABELS: Record<ReportTemplateKey, string> = {
  progress_report: "Progress Report",
  referral_acknowledgement: "Referral Acknowledgement",
}

export const DEFAULT_TEMPLATE_KEY: ReportTemplateKey = "progress_report"

export function isReportTemplateKey(value: string): value is ReportTemplateKey {
  return (REPORT_TEMPLATE_KEYS as readonly string[]).includes(value)
}

export function resolveTemplateKey(
  value: string | null | undefined
): ReportTemplateKey {
  if (value && isReportTemplateKey(value)) return value
  return DEFAULT_TEMPLATE_KEY
}
