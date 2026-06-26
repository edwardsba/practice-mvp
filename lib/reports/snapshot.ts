export type ReportResultRow = {
  assessmentResultId: string
  date: string
  score: number
  severity: string | null
  functionalImpairmentLabel?: string | null
  acuteRiskRating?: string | null
}

export type BtpReportTargetRow = {
  target: string
  score: number
  ratingLabel: string
}

export type BtpReportResultRow = {
  assessmentResultId: string
  date: string
  targets: BtpReportTargetRow[]
}

export type ReportRecipient = {
  type: "referrer" | "client" | "none"
  name: string | null
  organisationName: string | null
  streetAddress: string | null
  postalAddress: string | null
} | null

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
    displayName: string
  }
  practice: {
    practiceName: string
    practiceAddress: string | null
  }
  recipient: ReportRecipient
  dateRangeStart: string
  dateRangeEnd: string
  phq9Results: ReportResultRow[]
  gad7Results: ReportResultRow[]
  asqResults: ReportResultRow[]
  assistResults: ReportResultRow[]
  btpResults: BtpReportResultRow[]
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

export function getAsqResultsFromSnapshot(snapshot: ReportSnapshot): ReportResultRow[] {
  return snapshot.asqResults ?? []
}

export function getAssistResultsFromSnapshot(snapshot: ReportSnapshot): ReportResultRow[] {
  return snapshot.assistResults ?? []
}

export function getBtpResultsFromSnapshot(snapshot: ReportSnapshot): BtpReportResultRow[] {
  return snapshot.btpResults ?? []
}

export const REPORT_TITLE = "Progress Report"

/** Display label for report_type values stored in the database. */
export function formatReportType(_reportType: string) {
  return REPORT_TITLE
}

export function resolveReportTitle(): string {
  return REPORT_TITLE
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
  const asqResults = getAsqResultsFromSnapshot(raw)
  const assistResults = getAssistResultsFromSnapshot(raw)
  const btpResults = getBtpResultsFromSnapshot(raw)

  return {
    ...raw,
    reportTitle: REPORT_TITLE,
    practice: {
      practiceName: raw.practice.practiceName,
      practiceAddress: raw.practice.practiceAddress ?? null,
    },
    recipient: raw.recipient ?? null,
    practitioner: {
      ...raw.practitioner,
      displayName: raw.practitioner.displayName ?? raw.practitioner.fullName,
    },
    phq9Results,
    gad7Results,
    asqResults,
    assistResults,
    btpResults,
  }
}
