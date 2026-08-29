export const REPORT_TEMPLATE_KEYS = [
  "progress_report",
  "referral_acknowledgement",
  // SAGE-SR Diagnostic Report — deliberately NOT a simple_reports row (see
  // db/schema/19-sage-sr-diagnostic-reports.ts's docstring for why). Adding this key
  // here is what makes "SAGE-SR Diagnostic Report" selectable from the existing
  // report_types settings UI (components/settings/report-type-form.tsx renders one
  // <option> per REPORT_TEMPLATE_KEYS entry already — no change needed there) and is
  // what report-form.tsx's isSageDiagnostic branch checks for.
  "sage_sr_diagnostic",
] as const

export type ReportTemplateKey = (typeof REPORT_TEMPLATE_KEYS)[number]

export const REPORT_TEMPLATE_LABELS: Record<ReportTemplateKey, string> = {
  progress_report: "Progress Report",
  referral_acknowledgement: "Referral Acknowledgement",
  sage_sr_diagnostic: "SAGE-SR Diagnostic Report",
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
