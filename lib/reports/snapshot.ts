export type ReportResultRow = {
  assessmentResultId: string
  date: string
  score: number
  maxScore?: number | null
  severity: string | null
  functionalImpairmentLabel?: string | null
  acuteRiskRating?: string | null
}

export type BtpReportTargetRow = {
  target: string
  score: number
  maxScore?: number | null
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
  title: string | null
  firstName: string | null
  lastName: string | null
  organisationName: string | null
  streetAddress: string | null
  postalAddress: string | null
} | null

export type ReportFundingApproval = {
  approvalTypeName: string
  startDate: string | null
  appointmentsApproved: number | null
  appointmentsAttended: number
  requirementLabel: string | null
} | null

export type ReportSnapshot = {
  reportTitle: string
  templateKey: string
  generatedAt: string
  reportDate: string
  client: {
    firstName: string
    lastName: string
    dateOfBirth: string | null
  }
  practitioner: {
    title: string | null
    fullName: string
    displayName: string
    signatureDataUrl: string | null
  }
  practice: {
    practiceName: string
    practiceAddress: string | null
  }
  recipient: ReportRecipient
  fundingApproval: ReportFundingApproval
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
  therapeuticTarget: string | null
  behaviouralTargets: string[]
  assistEnabled: boolean
  selectedAppointmentIds?: string[]
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

/** Report list display: prefer the stored report type name, fall back to legacy label. */
export function formatReportType(reportTypeName: string | null | undefined): string {
  return reportTypeName?.trim() || REPORT_TITLE
}

/** @deprecated Title now comes from the selected report type name. Kept for callers that pass nothing. */
export function resolveReportTitle(reportTitle?: string | null): string {
  return reportTitle?.trim() || REPORT_TITLE
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
  if (!raw.client || !raw.practice) {
    return null
  }

  const phq9Results = getPhq9ResultsFromSnapshot(raw)
  const gad7Results = getGad7ResultsFromSnapshot(raw)
  const asqResults = getAsqResultsFromSnapshot(raw)
  const assistResults = getAssistResultsFromSnapshot(raw)
  const btpResults = getBtpResultsFromSnapshot(raw)

  return {
    ...raw,
    reportTitle: raw.reportTitle?.trim() || REPORT_TITLE,
    templateKey: raw.templateKey?.trim() || "progress_report",
    reportDate:
      raw.reportDate?.trim() ||
      raw.dateRangeEnd?.trim() ||
      (raw.generatedAt ? raw.generatedAt.slice(0, 10) : ""),
    practice: {
      practiceName: raw.practice.practiceName,
      practiceAddress: raw.practice.practiceAddress ?? null,
    },
    recipient: raw.recipient
      ? {
          ...raw.recipient,
          title: raw.recipient.title ?? null,
          firstName: raw.recipient.firstName ?? null,
          lastName: raw.recipient.lastName ?? null,
        }
      : null,
    fundingApproval: raw.fundingApproval ?? null,
    practitioner: {
      ...raw.practitioner,
      displayName: raw.practitioner.displayName ?? raw.practitioner.fullName,
      signatureDataUrl: raw.practitioner.signatureDataUrl ?? null,
    },
    phq9Results,
    gad7Results,
    asqResults,
    assistResults,
    btpResults,
    therapeuticTarget: raw.therapeuticTarget ?? null,
    behaviouralTargets: raw.behaviouralTargets ?? [],
    assistEnabled: raw.assistEnabled ?? false,
    selectedAppointmentIds: raw.selectedAppointmentIds ?? [],
  }
}
