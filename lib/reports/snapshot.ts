export type ReportResultRow = {
  assessmentResultId: string
  date: string
  score: number
  severity: string
}

export type ReportSnapshot = {
  reportTitle: string
  generatedAt: string
  client: {
    firstName: string
    lastName: string
    dateOfBirth: string | null
  }
  practitioner: {
    title: string | null
    fullName: string
  }
  practice: {
    practiceName: string
  }
  dateRangeStart: string
  dateRangeEnd: string
  phq9Results: ReportResultRow[]
  gad7Results: ReportResultRow[]
  /** @deprecated Legacy snapshots used a single results array */
  results?: ReportResultRow[]
  clinicalSummaryText: string | null
  recommendationsText: string | null
}

export function getPhq9ResultsFromSnapshot(snapshot: ReportSnapshot): ReportResultRow[] {
  if (snapshot.phq9Results?.length) return snapshot.phq9Results
  return snapshot.results ?? []
}

export function getGad7ResultsFromSnapshot(snapshot: ReportSnapshot): ReportResultRow[] {
  return snapshot.gad7Results ?? []
}

export function formatReportType(reportType: string) {
  if (reportType === "phq9_progress") return "PHQ-9 Progress"
  if (reportType === "gad7_progress") return "GAD-7 Progress"
  if (reportType === "combined_progress") return "Combined Progress"
  return reportType.replace(/_/g, " ")
}

export function resolveReportTitle(
  phq9Count: number,
  gad7Count: number
): string {
  if (phq9Count > 0 && gad7Count > 0) return "Combined Progress Report"
  if (gad7Count > 0) return "GAD-7 Progress Report"
  return "PHQ-9 Progress Report"
}

export function resolveReportType(
  phq9Count: number,
  gad7Count: number
): string {
  if (phq9Count > 0 && gad7Count > 0) return "combined_progress"
  if (gad7Count > 0) return "gad7_progress"
  return "phq9_progress"
}

export function parseReportSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object") return null
  const raw = value as ReportSnapshot
  if (!raw.reportTitle || !raw.client || !raw.practice) {
    return null
  }

  const phq9Results = getPhq9ResultsFromSnapshot(raw)
  const gad7Results = getGad7ResultsFromSnapshot(raw)

  return {
    ...raw,
    phq9Results,
    gad7Results,
  }
}
