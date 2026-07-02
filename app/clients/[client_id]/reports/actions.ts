"use server"

import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
  appointments,
  auditEvents,
  clients,
  fundingApprovalReportLinks,
  fundingApprovalTypeReports,
  fundingApprovalTypes,
  fundingApprovals,
  practitionerProfiles,
  practices,
  sessionNotes,
  simpleReports,
  treatmentPlans,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getSignatureAsDataUrl } from "@/lib/practitioner/signature"
import {
  formatPractitionerFormalName,
  formatPractitionerName,
} from "@/lib/practitioner/format"
import {
  GAD7_IMPAIRMENT_ELEMENT_KEY,
  getFunctionalImpairmentLabelsByResultId,
  PHQ9_IMPAIRMENT_ELEMENT_KEY,
} from "@/lib/assessments/impairment"
import {
  loadBtpResultsForAppointments,
  loadBtpResultsForDateRange,
} from "@/lib/assessments/btp-results"
import { getMaxScoreForAssessmentDefinition } from "@/lib/assessments/max-score"
import type {
  BtpReportResultRow,
  ReportFundingApproval,
  ReportRecipient,
  ReportResultRow,
  ReportSnapshot,
} from "@/lib/reports/snapshot"
import {
  resolveReportType,
} from "@/lib/reports/snapshot"
import { resolveTemplateKey } from "@/lib/reports/templates"
import { getClientFundingApprovalsForReport } from "@/lib/actions/funding"
import { todayDateString } from "@/lib/appointments/format"

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

async function buildReferrerRecipient(
  clientId: string,
  practiceId: string,
  fundingApprovalId: string
): Promise<ReportRecipient> {
  const approvals = await getClientFundingApprovalsForReport(clientId, practiceId)
  const approval =
    approvals.find((a) => a.fundingApprovalId === fundingApprovalId) ?? null
  if (!approval) {
    return {
      type: "referrer",
      name: null,
      title: null,
      firstName: null,
      lastName: null,
      organisationName: null,
      streetAddress: null,
      postalAddress: null,
    }
  }
  return {
    type: "referrer",
    name:
      [approval.referrerTitle, approval.referrerFirstName, approval.referrerName]
        .filter(Boolean)
        .join(" ") || null,
    title: approval.referrerTitle ?? null,
    firstName: approval.referrerFirstName ?? null,
    lastName: approval.referrerName ?? null,
    organisationName: approval.organisationName,
    streetAddress: approval.streetAddress,
    postalAddress: approval.postalAddress,
  }
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

async function fetchResultsForAppointments(
  clientId: string,
  practiceId: string,
  assessmentCode: string,
  appointmentIds: string[],
  options?: {
    includeAcuteRisk?: boolean
    impairmentElementKey?: string
    linkViaSessionNote?: boolean
  }
): Promise<ReportPreviewRow[]> {
  if (appointmentIds.length === 0) return []

  const selectFields = {
    assessmentResultId: assessmentResults.assessmentResultId,
    assessmentDate: assessmentResults.assessmentDate,
    score: assessmentResults.score,
    severity: assessmentResults.severity,
    acuteRiskRating: assessmentResults.acuteRiskRating,
    assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
  }

  const rows = options?.linkViaSessionNote
    ? await db
        .select(selectFields)
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
        .innerJoin(
          sessionNotes,
          eq(sessionNotes.sessionNoteId, assessmentInstances.sessionNoteId)
        )
        .where(
          and(
            eq(assessmentResults.clientId, clientId),
            eq(assessmentResults.practiceId, practiceId),
            eq(assessmentDefinitions.assessmentCode, assessmentCode),
            inArray(sessionNotes.appointmentId, appointmentIds)
          )
        )
        .orderBy(desc(assessmentResults.assessmentDate))
    : await db
        .select(selectFields)
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
            inArray(assessmentInstances.appointmentId, appointmentIds)
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
    functionalImpairmentLabel:
      impairmentLabels.get(row.assessmentResultId) ?? null,
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

export async function fetchReportResultsForAppointments(
  clientId: string,
  appointmentIds: string[]
): Promise<{ preview: ReportRangePreview; error?: string }> {
  const context = await requirePractitionerContext()

  if (appointmentIds.length === 0) {
    return {
      preview: {
        phq9Results: [],
        gad7Results: [],
        asqResults: [],
        assistResults: [],
        btpResults: [],
      },
      error: "Please select at least one appointment.",
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

  const [phq9Results, gad7Results, asqResults, assistResults, btpSummaries] =
    await Promise.all([
      fetchResultsForAppointments(
        clientId,
        context.practiceId,
        "PHQ9",
        appointmentIds,
        { impairmentElementKey: PHQ9_IMPAIRMENT_ELEMENT_KEY }
      ),
      fetchResultsForAppointments(
        clientId,
        context.practiceId,
        "GAD7",
        appointmentIds,
        { impairmentElementKey: GAD7_IMPAIRMENT_ELEMENT_KEY }
      ),
      fetchResultsForAppointments(
        clientId,
        context.practiceId,
        "ASQ",
        appointmentIds,
        { includeAcuteRisk: true, linkViaSessionNote: true }
      ),
      fetchResultsForAppointments(
        clientId,
        context.practiceId,
        "ASSIST",
        appointmentIds
      ),
      loadBtpResultsForAppointments(
        clientId,
        context.practiceId,
        appointmentIds
      ),
    ])

  const btpResults: BtpReportResultRow[] = btpSummaries.map((result) => ({
    assessmentResultId: result.assessmentResultId,
    date: result.assessmentDate.toISOString(),
    targets: result.targets.map((t) => ({ ...t, maxScore: 5 })),
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
  recipient: ReportRecipient,
  fundingApprovalId: string | null,
  reportRequirementId: string | null,
  selectedAppointmentIds: string[],
  reportTitle: string,
  templateKey: string,
  reportDate: string
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

  let fundingApproval: ReportFundingApproval = null

  if (fundingApprovalId) {
    const [approval] = await db
      .select({
        approvalTypeName: fundingApprovalTypes.name,
        startDate: fundingApprovals.startDate,
        appointmentsApproved: fundingApprovals.appointmentsApproved,
        fundingApprovalTypeId: fundingApprovals.fundingApprovalTypeId,
      })
      .from(fundingApprovals)
      .leftJoin(
        fundingApprovalTypes,
        eq(
          fundingApprovals.fundingApprovalTypeId,
          fundingApprovalTypes.fundingApprovalTypeId
        )
      )
      .where(eq(fundingApprovals.fundingApprovalId, fundingApprovalId))
      .limit(1)

    if (approval) {
      const [attendedRow] = await db
        .select({ total: count() })
        .from(appointments)
        .where(
          and(
            eq(appointments.fundingApprovalId, fundingApprovalId),
            eq(appointments.status, "completed")
          )
        )
      const appointmentsAttended = Number(attendedRow?.total ?? 0)

      let requirementLabel: string | null = null
      if (reportRequirementId) {
        const [req] = await db
          .select({
            appointmentNumber: fundingApprovalTypeReports.appointmentNumber,
          })
          .from(fundingApprovalTypeReports)
          .where(
            eq(
              fundingApprovalTypeReports.reportRequirementId,
              reportRequirementId
            )
          )
          .limit(1)
        if (req) {
          requirementLabel = `Report at appointment ${req.appointmentNumber}`
        }
      }

      fundingApproval = {
        approvalTypeName: approval.approvalTypeName ?? "—",
        startDate: approval.startDate,
        appointmentsApproved: approval.appointmentsApproved,
        appointmentsAttended,
        requirementLabel,
      }
    }
  }

  const [activeTreatmentPlan] = await db
    .select({ therapeuticTarget: treatmentPlans.therapeuticTarget })
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.clientId, clientId),
        eq(treatmentPlans.practiceId, context.practiceId),
        eq(treatmentPlans.isActive, true)
      )
    )
    .orderBy(desc(treatmentPlans.versionNumber))
    .limit(1)

  const therapeuticTarget = activeTreatmentPlan?.therapeuticTarget ?? null

  return {
    reportTitle: reportTitle?.trim() || "Progress Report",
    templateKey: resolveTemplateKey(templateKey),
    generatedAt: new Date().toISOString(),
    reportDate: reportDate?.trim() || todayDateString(),
    client: {
      firstName: client.firstName,
      lastName: client.lastName,
      dateOfBirth: client.dateOfBirth,
    },
    practitioner: {
      title: practitioner.title,
      fullName: formatPractitionerName(practitioner),
      displayName: formatPractitionerFormalName(practitioner),
      signatureDataUrl,
    },
    practice: {
      practiceName: practice.practiceName,
      practiceAddress: practice.practiceAddress ?? null,
    },
    recipient,
    fundingApproval,
    dateRangeStart,
    dateRangeEnd,
    phq9Results,
    gad7Results,
    asqResults,
    assistResults,
    btpResults,
    clinicalSummaryText,
    recommendationsText,
    therapeuticTarget,
    selectedAppointmentIds,
  }
}

export type SaveReportDraftState = {
  error?: string
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function linkReportToRequirement(
  tx: DbTransaction,
  reportRequirementId: string | null,
  fundingApprovalId: string | null,
  simpleReportId: string
) {
  if (!reportRequirementId || !fundingApprovalId) return

  const [req] = await tx
    .select({
      appointmentNumber: fundingApprovalTypeReports.appointmentNumber,
    })
    .from(fundingApprovalTypeReports)
    .where(
      eq(fundingApprovalTypeReports.reportRequirementId, reportRequirementId)
    )
    .limit(1)

  if (!req) return

  await tx
    .update(fundingApprovalReportLinks)
    .set({ simpleReportId, updatedAt: new Date() })
    .where(
      and(
        eq(fundingApprovalReportLinks.fundingApprovalId, fundingApprovalId),
        eq(
          fundingApprovalReportLinks.appointmentNumber,
          req.appointmentNumber
        )
      )
    )
}

export async function saveReportDraft(
  clientId: string,
  _prevState: SaveReportDraftState,
  formData: FormData
): Promise<SaveReportDraftState> {
  const context = await requirePractitionerContext()

  let dateRangeStart = String(formData.get("date_range_start") ?? "").trim()
  let dateRangeEnd = String(formData.get("date_range_end") ?? "").trim()
  const clinicalSummaryText =
    String(formData.get("clinical_summary_text") ?? "").trim() || null
  const recommendationsText =
    String(formData.get("recommendations_text") ?? "").trim() || null
  const recipientTypeRaw = String(formData.get("recipient_type") ?? "").trim()
  const fundingApprovalIdRaw =
    String(formData.get("funding_approval_id") ?? "").trim() || null
  const reportRequirementId =
    String(formData.get("report_requirement_id") ?? "").trim() || null
  const appointmentIdsRaw =
    String(formData.get("appointment_ids") ?? "").trim()
  const appointmentIds = appointmentIdsRaw
    ? appointmentIdsRaw.split(",").map((id) => id.trim()).filter(Boolean)
    : []
  const reportTypeId =
    String(formData.get("report_type_id") ?? "").trim() || null
  const templateKey = resolveTemplateKey(
    String(formData.get("template_key") ?? "")
  )
  const reportTitle =
    String(formData.get("report_title") ?? "").trim() || "Progress Report"
  const reportDate =
    String(formData.get("report_date") ?? "").trim() || todayDateString()

  const isReferrerLegacy = recipientTypeRaw.startsWith("referrer:")
  const recipientType =
    recipientTypeRaw === "referrer" || isReferrerLegacy
      ? "referrer"
      : recipientTypeRaw === "client"
        ? "client"
        : "none"
  const fundingApprovalId = isReferrerLegacy
    ? (recipientTypeRaw.split(":")[1] ?? fundingApprovalIdRaw)
    : fundingApprovalIdRaw

  const emptyPreview: ReportRangePreview = {
    phq9Results: [],
    gad7Results: [],
    asqResults: [],
    assistResults: [],
    btpResults: [],
  }

  if (templateKey === "referral_acknowledgement") {
    if (!fundingApprovalId) {
      return {
        error: "Select a funding approval to address the acknowledgement to.",
      }
    }

    const recipient = await buildReferrerRecipient(
      clientId,
      context.practiceId,
      fundingApprovalId
    )
    const today = new Date().toISOString().slice(0, 10)

    const snapshot = await buildSnapshot(
      clientId,
      context,
      "",
      "",
      emptyPreview.phq9Results,
      emptyPreview.gad7Results,
      emptyPreview.asqResults,
      emptyPreview.assistResults,
      emptyPreview.btpResults,
      clinicalSummaryText,
      null,
      recipient,
      fundingApprovalId,
      null,
      [],
      reportTitle,
      templateKey,
      reportDate
    )

    if (!snapshot) {
      return { error: "Unable to save report. Client or practice not found." }
    }

    const report = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(simpleReports)
        .values({
          clientId,
          practiceId: context.practiceId,
          practitionerProfileId: context.practitionerProfileId,
          reportType: "referral_acknowledgement",
          reportTypeId,
          reportDate,
          dateRangeStart: today,
          dateRangeEnd: today,
          valuesSnapshotJson: snapshot,
          clinicalSummaryText,
          recommendationsText: null,
          reportStatus: "draft",
          recipientType: "referrer",
          fundingApprovalId,
          reportRequirementId,
        })
        .returning({ simpleReportId: simpleReports.simpleReportId })

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId,
        eventType: "report.created",
        entityType: "simple_report",
        entityId: inserted.simpleReportId,
      })

      await linkReportToRequirement(
        tx,
        reportRequirementId,
        fundingApprovalId,
        inserted.simpleReportId
      )

      return inserted
    })

    redirect(`/clients/${clientId}/reports/${report.simpleReportId}`)
  }

  let preview: ReportRangePreview
  let previewError: string | undefined

  if (appointmentIds.length > 0) {
    const result = await fetchReportResultsForAppointments(
      clientId,
      appointmentIds
    )
    preview = result.preview
    previewError = result.error
  } else {
    if (!dateRangeStart || !dateRangeEnd) {
      return { error: "Please select a start and end date." }
    }
    if (dateRangeStart > dateRangeEnd) {
      return { error: "Start date must be on or before end date." }
    }
    const result = await fetchReportResultsForRange(
      clientId,
      dateRangeStart,
      dateRangeEnd
    )
    preview = result.preview
    previewError = result.error
  }

  if (previewError) {
    return { error: previewError }
  }

  let recipient: ReportRecipient = {
    type: "none",
    name: null,
    title: null,
    firstName: null,
    lastName: null,
    organisationName: null,
    streetAddress: null,
    postalAddress: null,
  }

  if (recipientType === "client") {
    const client = await verifyClient(clientId, context.practiceId)
    recipient = {
      type: "client",
      name: client ? `${client.firstName} ${client.lastName}` : null,
      title: null,
      firstName: null,
      lastName: null,
      organisationName: null,
      streetAddress: null,
      postalAddress: null,
    }
  } else if (recipientType === "referrer" && fundingApprovalId) {
    recipient = await buildReferrerRecipient(
      clientId,
      context.practiceId,
      fundingApprovalId
    )
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
    recipient,
    fundingApprovalId,
    reportRequirementId,
    appointmentIds,
    reportTitle,
    templateKey,
    reportDate
  )

  if (!snapshot) {
    return { error: "Unable to save report. Client or practice not found." }
  }

  const reportType = resolveReportType(
    preview.phq9Results.length,
    preview.gad7Results.length
  )

  const report = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(simpleReports)
      .values({
        clientId,
        practiceId: context.practiceId,
        practitionerProfileId: context.practitionerProfileId,
        reportType,
        reportTypeId,
        reportDate,
        dateRangeStart,
        dateRangeEnd,
        valuesSnapshotJson: snapshot,
        clinicalSummaryText,
        recommendationsText,
        reportStatus: "draft",
        recipientType: recipientType === "none" ? null : recipientType,
        fundingApprovalId,
        reportRequirementId,
      })
      .returning({ simpleReportId: simpleReports.simpleReportId })

    await linkReportToRequirement(
      tx,
      reportRequirementId,
      fundingApprovalId,
      inserted.simpleReportId
    )

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "report.created",
      entityType: "simple_report",
      entityId: inserted.simpleReportId,
    })

    return inserted
  })

  redirect(`/clients/${clientId}/reports/${report.simpleReportId}`)
}
