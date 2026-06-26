"use server"

import { and, desc, eq, gte, lte } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
  auditEvents,
  clients,
  practitionerProfiles,
  practices,
  simpleReports,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getSignatureAsDataUrl } from "@/lib/practitioner/signature"
import {
  formatPractitionerName,
} from "@/lib/practitioner/format"
import {
  GAD7_IMPAIRMENT_ELEMENT_KEY,
  getFunctionalImpairmentLabelsByResultId,
  PHQ9_IMPAIRMENT_ELEMENT_KEY,
} from "@/lib/assessments/impairment"
import { loadBtpResultsForDateRange } from "@/lib/assessments/btp-results"
import { getMaxScoreForAssessmentDefinition } from "@/lib/assessments/max-score"
import type {
  BtpReportResultRow,
  ReportRecipient,
  ReportResultRow,
  ReportSnapshot,
} from "@/lib/reports/snapshot"
import {
  resolveReportTitle,
  resolveReportType,
} from "@/lib/reports/snapshot"
import { getClientFundingApprovalsForReport } from "@/lib/actions/funding"

export type ReportPreviewRow = ReportResultRow

export type ReportRangePreview = {
  phq9Results: ReportPreviewRow[]
  gad7Results: ReportPreviewRow[]
  asqResults: ReportPreviewRow[]
  assistResults: ReportPreviewRow[]
  btpResults: BtpReportResultRow[]
}

async function verifyClient(clientId: string, practiceId: string) {
  const [client] = await db
    .select({
      clientId: clients.clientId,
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  return client ?? null
}

async function fetchResultsForAssessment(
  clientId: string,
  practiceId: string,
  assessmentCode: string,
  rangeStart: Date,
  rangeEnd: Date,
  options?: { includeAcuteRisk?: boolean; impairmentElementKey?: string }
): Promise<ReportPreviewRow[]> {
  const rows = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
      acuteRiskRating: assessmentResults.acuteRiskRating,
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(
        assessmentResults.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, assessmentCode),
        gte(assessmentResults.assessmentDate, rangeStart),
        lte(assessmentResults.assessmentDate, rangeEnd)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const impairmentLabels = options?.impairmentElementKey
    ? await getFunctionalImpairmentLabelsByResultId(
        rows.map((row) => row.assessmentResultId),
        options.impairmentElementKey
      )
    : new Map<string, string>()

  const assessmentDefinitionId = rows[0]?.assessmentDefinitionId ?? null
  const maxScore = assessmentDefinitionId
    ? await getMaxScoreForAssessmentDefinition(assessmentDefinitionId)
    : null

  return rows.map((row) => ({
    assessmentResultId: row.assessmentResultId,
    date: row.assessmentDate.toISOString(),
    score: row.score,
    maxScore: maxScore ?? null,
    severity: row.severity,
    functionalImpairmentLabel: impairmentLabels.get(row.assessmentResultId) ?? null,
    acuteRiskRating: options?.includeAcuteRisk
      ? assessmentCode === "ASQ"
        ? row.severity
        : row.acuteRiskRating
      : undefined,
  }))
}

export async function fetchReportResultsForRange(
  clientId: string,
  dateRangeStart: string,
  dateRangeEnd: string
): Promise<{ preview: ReportRangePreview; error?: string }> {
  const context = await requirePractitionerContext()

  if (!dateRangeStart || !dateRangeEnd) {
    return {
      preview: {
        phq9Results: [],
        gad7Results: [],
        asqResults: [],
        assistResults: [],
        btpResults: [],
      },
      error: "Please select a start and end date.",
    }
  }

  if (dateRangeStart > dateRangeEnd) {
    return {
      preview: {
        phq9Results: [],
        gad7Results: [],
        asqResults: [],
        assistResults: [],
        btpResults: [],
      },
      error: "Start date must be on or before end date.",
    }
  }

  const client = await verifyClient(clientId, context.practiceId)
  if (!client) {
    return {
      preview: {
        phq9Results: [],
        gad7Results: [],
        asqResults: [],
        assistResults: [],
        btpResults: [],
      },
      error: "Client not found.",
    }
  }

  const rangeStart = new Date(`${dateRangeStart}T00:00:00`)
  const rangeEnd = new Date(`${dateRangeEnd}T23:59:59.999`)

  const [phq9Results, gad7Results, asqResults, assistResults, btpSummaries] =
    await Promise.all([
    fetchResultsForAssessment(
      clientId,
      context.practiceId,
      "PHQ9",
      rangeStart,
      rangeEnd,
      { impairmentElementKey: PHQ9_IMPAIRMENT_ELEMENT_KEY }
    ),
    fetchResultsForAssessment(
      clientId,
      context.practiceId,
      "GAD7",
      rangeStart,
      rangeEnd,
      { impairmentElementKey: GAD7_IMPAIRMENT_ELEMENT_KEY }
    ),
    fetchResultsForAssessment(
      clientId,
      context.practiceId,
      "ASQ",
      rangeStart,
      rangeEnd,
      { includeAcuteRisk: true }
    ),
    fetchResultsForAssessment(
      clientId,
      context.practiceId,
      "ASSIST",
      rangeStart,
      rangeEnd
    ),
    loadBtpResultsForDateRange(clientId, context.practiceId, rangeStart, rangeEnd),
  ])

  const btpResults: BtpReportResultRow[] = btpSummaries.map((result) => ({
    assessmentResultId: result.assessmentResultId,
    date: result.assessmentDate.toISOString(),
    targets: result.targets.map((t) => ({
      ...t,
      maxScore: 5,
    })),
  }))

  return {
    preview: { phq9Results, gad7Results, asqResults, assistResults, btpResults },
  }
}

/** @deprecated Use fetchReportResultsForRange */
export async function fetchPhq9ResultsForRange(
  clientId: string,
  dateRangeStart: string,
  dateRangeEnd: string
): Promise<{ results: ReportPreviewRow[]; error?: string }> {
  const { preview, error } = await fetchReportResultsForRange(
    clientId,
    dateRangeStart,
    dateRangeEnd
  )
  return { results: preview.phq9Results, error }
}

export async function buildSnapshot(
  clientId: string,
  context: Awaited<ReturnType<typeof requirePractitionerContext>>,
  dateRangeStart: string,
  dateRangeEnd: string,
  phq9Results: ReportPreviewRow[],
  gad7Results: ReportPreviewRow[],
  asqResults: ReportPreviewRow[],
  assistResults: ReportPreviewRow[],
  btpResults: BtpReportResultRow[],
  clinicalSummaryText: string | null,
  recommendationsText: string | null,
  recipient: ReportRecipient
): Promise<ReportSnapshot | null> {
  const client = await verifyClient(clientId, context.practiceId)
  if (!client) return null

  const [practitioner] = await db
    .select({
      title: practitionerProfiles.title,
      firstName: practitionerProfiles.firstName,
      preferredName: practitionerProfiles.preferredName,
      lastName: practitionerProfiles.lastName,
      reportSignature: practitionerProfiles.reportSignature,
      signatureImagePath: practitionerProfiles.signatureImagePath,
    })
    .from(practitionerProfiles)
    .where(
      eq(practitionerProfiles.practitionerProfileId, context.practitionerProfileId)
    )
    .limit(1)

  const [practice] = await db
    .select({
      practiceName: practices.practiceName,
      practiceAddress: practices.address,
    })
    .from(practices)
    .where(eq(practices.practiceId, context.practiceId))
    .limit(1)

  if (!practitioner || !practice) return null

  const signatureDataUrl = practitioner.signatureImagePath
    ? await getSignatureAsDataUrl(practitioner.signatureImagePath)
    : null

  return {
    reportTitle: resolveReportTitle(),
    generatedAt: new Date().toISOString(),
    client: {
      firstName: client.firstName,
      lastName: client.lastName,
      dateOfBirth: client.dateOfBirth,
    },
    practitioner: {
      title: practitioner.title,
      fullName: formatPractitionerName(practitioner),
      displayName: formatPractitionerName(practitioner),
      signatureDataUrl,
    },
    practice: {
      practiceName: practice.practiceName,
      practiceAddress: practice.practiceAddress ?? null,
    },
    recipient,
    dateRangeStart,
    dateRangeEnd,
    phq9Results,
    gad7Results,
    asqResults,
    assistResults,
    btpResults,
    clinicalSummaryText,
    recommendationsText,
  }
}

export type SaveReportDraftState = {
  error?: string
}

export async function saveReportDraft(
  clientId: string,
  _prevState: SaveReportDraftState,
  formData: FormData
): Promise<SaveReportDraftState> {
  const context = await requirePractitionerContext()

  const dateRangeStart = String(formData.get("date_range_start") ?? "").trim()
  const dateRangeEnd = String(formData.get("date_range_end") ?? "").trim()
  const clinicalSummaryText =
    String(formData.get("clinical_summary_text") ?? "").trim() || null
  const recommendationsText =
    String(formData.get("recommendations_text") ?? "").trim() || null
  const recipientTypeRaw = String(formData.get("recipient_type") ?? "").trim()
  const fundingApprovalIdRaw =
    String(formData.get("funding_approval_id") ?? "").trim() || null

  const isReferrer = recipientTypeRaw.startsWith("referrer:")
  const recipientType = isReferrer
    ? "referrer"
    : recipientTypeRaw === "client"
      ? "client"
      : "none"
  const fundingApprovalId = isReferrer
    ? (recipientTypeRaw.split(":")[1] ?? fundingApprovalIdRaw)
    : null

  if (!dateRangeStart || !dateRangeEnd) {
    return { error: "Please select a start and end date." }
  }

  if (dateRangeStart > dateRangeEnd) {
    return { error: "Start date must be on or before end date." }
  }

  const { preview, error } = await fetchReportResultsForRange(
    clientId,
    dateRangeStart,
    dateRangeEnd
  )

  if (error) {
    return { error }
  }

  let recipient: ReportRecipient = {
    type: "none",
    name: null,
    organisationName: null,
    streetAddress: null,
    postalAddress: null,
  }

  if (recipientType === "client") {
    const client = await verifyClient(clientId, context.practiceId)
    recipient = {
      type: "client",
      name: client ? `${client.firstName} ${client.lastName}` : null,
      organisationName: null,
      streetAddress: null,
      postalAddress: null,
    }
  } else if (recipientType === "referrer" && fundingApprovalId) {
    const approvals = await getClientFundingApprovalsForReport(
      clientId,
      context.practiceId
    )
    const approval =
      approvals.find((a) => a.fundingApprovalId === fundingApprovalId) ?? null
    if (approval) {
      recipient = {
        type: "referrer",
        name:
          [approval.referrerTitle, approval.referrerName]
            .filter(Boolean)
            .join(" ") || null,
        organisationName: approval.organisationName,
        streetAddress: approval.streetAddress,
        postalAddress: approval.postalAddress,
      }
    }
  }

  const snapshot = await buildSnapshot(
    clientId,
    context,
    dateRangeStart,
    dateRangeEnd,
    preview.phq9Results,
    preview.gad7Results,
    preview.asqResults,
    preview.assistResults,
    preview.btpResults,
    clinicalSummaryText,
    recommendationsText,
    recipient
  )

  if (!snapshot) {
    return { error: "Unable to save report. Client or practice not found." }
  }

  const reportType = resolveReportType(
    preview.phq9Results.length,
    preview.gad7Results.length
  )

  const [report] = await db
    .insert(simpleReports)
    .values({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      reportType,
      dateRangeStart,
      dateRangeEnd,
      valuesSnapshotJson: snapshot,
      clinicalSummaryText,
      recommendationsText,
      reportStatus: "draft",
      recipientType: recipientType === "none" ? null : recipientType,
      fundingApprovalId,
    })
    .returning({ simpleReportId: simpleReports.simpleReportId })

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "report.created",
    entityType: "simple_report",
    entityId: report.simpleReportId,
  })

  redirect(`/clients/${clientId}/reports/${report.simpleReportId}`)
}
