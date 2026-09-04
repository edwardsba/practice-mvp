import type { SageSrDiagnosticReportPdfMeta } from "@/lib/reports/generate-sage-sr-diagnostic-pdf"

export function buildSageSrDiagnosticReportFilename(
  meta: SageSrDiagnosticReportPdfMeta,
  lastName: string,
  firstName: string
): string {
  const datePrefix =
    (meta.reportDate ? meta.reportDate.slice(0, 10) : "") ||
    new Date().toISOString().slice(0, 10)
  const titleSlug = (meta.title || "Report")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `${datePrefix}_Confidential_${titleSlug}_${lastName}_${firstName?.[0] ?? ""}.pdf`
}
