import type { ReportSnapshot } from "@/lib/reports/snapshot"

export function buildReportFilename(
  snapshot: ReportSnapshot,
  reportDateColumn: string | null,
  clientLastName: string,
  clientFirstName: string
): string {
  const datePrefix =
    snapshot.reportDate?.slice(0, 10) ||
    (reportDateColumn ? reportDateColumn.slice(0, 10) : "") ||
    (snapshot.dateRangeEnd ? snapshot.dateRangeEnd.slice(0, 10) : "") ||
    new Date().toISOString().slice(0, 10)
  const titleSlug = (snapshot.reportTitle || "Report")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `${datePrefix}_Confidential_${titleSlug}_${clientLastName}_${clientFirstName?.[0] ?? ""}.pdf`
}
