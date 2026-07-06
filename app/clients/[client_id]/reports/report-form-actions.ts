"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  buildReferrerRecipient,
  buildSnapshot,
  fetchReportResultsForAppointments,
  fetchReportResultsForRange,
  linkReportToRequirement,
  type ReportRangePreview,
} from "@/app/clients/[client_id]/reports/actions"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { commitReportDraft, commitReportFinalise } from "@/lib/reports/commit"
import { generateReportPdf } from "@/lib/reports/generate-pdf"
import { resolveReportType, type ReportSnapshot } from "@/lib/reports/snapshot"
import { resolveTemplateKey } from "@/lib/reports/templates"
import { todayDateString } from "@/lib/appointments/format"
import type { ReportRecipient } from "@/lib/reports/snapshot"

type ParsedReportValues = {
  reportType: string
  reportTypeId: string | null
  reportDate: string
  dateRangeStart: string
  dateRangeEnd: string
  snapshot: ReportSnapshot
  clinicalSummaryText: string | null
  recommendationsText: string | null
  recipientType: string | null
  fundingApprovalId: string | null
  reportRequirementId: string | null
}

async function parseReportForm(
  clientId: string,
  practiceId: string,
  practitionerProfileId: string,
  formData: FormData
): Promise<{ error?: string; values?: ParsedReportValues }> {
  const context = await requirePractitionerContext()
  const dateRangeStart = String(formData.get("date_range_start") ?? "").trim()
  const dateRangeEnd = String(formData.get("date_range_end") ?? "").trim()
  const clinicalSummaryText =
    String(formData.get("clinical_summary_text") ?? "").trim() || null
  const recommendationsText =
    String(formData.get("recommendations_text") ?? "").trim() || null
  const recipientTypeRaw = String(formData.get("recipient_type") ?? "").trim()
  const fundingApprovalId =
    String(formData.get("funding_approval_id") ?? "").trim() || null
  const reportRequirementId =
    String(formData.get("report_requirement_id") ?? "").trim() || null
  const appointmentIdsRaw = String(formData.get("appointment_ids") ?? "").trim()
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

  const recipientType =
    recipientTypeRaw === "referrer"
      ? "referrer"
      : recipientTypeRaw === "client"
        ? "client"
        : "none"

  if (templateKey === "referral_acknowledgement") {
    if (!fundingApprovalId) {
      return {
        error: "Select a funding approval to address the acknowledgement to.",
      }
    }

    const recipient = await buildReferrerRecipient(
      clientId,
      practiceId,
      fundingApprovalId
    )
    const today = todayDateString()

    const snapshot = await buildSnapshot(
      clientId,
      context,
      "",
      "",
      [],
      [],
      [],
      [],
      [],
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

    return {
      values: {
        reportType: "referral_acknowledgement",
        reportTypeId,
        reportDate,
        dateRangeStart: today,
        dateRangeEnd: today,
        snapshot,
        clinicalSummaryText,
        recommendationsText: null,
        recipientType: "referrer",
        fundingApprovalId,
        reportRequirementId,
      },
    }
  }

  let preview: ReportRangePreview
  let previewError: string | undefined

  if (appointmentIds.length > 0) {
    const result = await fetchReportResultsForAppointments(clientId, appointmentIds)
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
    recipient = { ...recipient, type: "client" }
  } else if (recipientType === "referrer" && fundingApprovalId) {
    recipient = await buildReferrerRecipient(clientId, practiceId, fundingApprovalId)
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

  return {
    values: {
      reportType,
      reportTypeId,
      reportDate,
      dateRangeStart,
      dateRangeEnd,
      snapshot,
      clinicalSummaryText,
      recommendationsText,
      recipientType: recipientType === "none" ? null : recipientType,
      fundingApprovalId,
      reportRequirementId,
    },
  }
}

export type PreviewReportState = {
  error?: string
  pdfBase64?: string
}

export async function previewReport(
  clientId: string,
  _existingDraftReportId: string | null,
  _previousVersionId: string | null,
  _prevState: PreviewReportState,
  formData: FormData
): Promise<PreviewReportState> {
  const context = await requirePractitionerContext()

  const result = await parseReportForm(
    clientId,
    context.practiceId,
    context.practitionerProfileId,
    formData
  )
  if (result.error || !result.values) {
    return { error: result.error ?? "Unable to build preview." }
  }

  const buffer = await generateReportPdf(result.values.snapshot)
  return { pdfBase64: buffer.toString("base64") }
}

export type SaveReportDraftState = {
  error?: string
}

export async function saveReportDraftAction(
  clientId: string,
  existingDraftReportId: string | null,
  previousVersionId: string | null,
  _prevState: SaveReportDraftState,
  formData: FormData
): Promise<SaveReportDraftState> {
  const context = await requirePractitionerContext()

  const result = await parseReportForm(
    clientId,
    context.practiceId,
    context.practitionerProfileId,
    formData
  )
  if (result.error || !result.values) {
    return { error: result.error ?? "Unable to save report." }
  }

  const { simpleReportId } = await commitReportDraft({
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId: context.practitionerProfileId,
    userId: context.userId,
    existingDraftReportId,
    previousVersionId,
    values: result.values,
  })

  revalidatePath(`/clients/${clientId}`)

  if (!existingDraftReportId) {
    redirect(`/clients/${clientId}/reports/${simpleReportId}/edit`)
  }

  return {}
}

export type FinaliseReportState = {
  error?: string
}

export async function finaliseReportAction(
  clientId: string,
  existingDraftReportId: string | null,
  previousVersionId: string | null,
  _prevState: FinaliseReportState,
  formData: FormData
): Promise<FinaliseReportState> {
  const context = await requirePractitionerContext()

  const result = await parseReportForm(
    clientId,
    context.practiceId,
    context.practitionerProfileId,
    formData
  )
  if (result.error || !result.values) {
    return { error: result.error ?? "Unable to finalise report." }
  }

  const { simpleReportId } = await commitReportFinalise({
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId: context.practitionerProfileId,
    userId: context.userId,
    existingDraftReportId,
    previousVersionId,
    values: result.values,
  })

  if (result.values.reportRequirementId && result.values.fundingApprovalId) {
    await db.transaction(async (tx) => {
      await linkReportToRequirement(
        tx,
        result.values!.reportRequirementId,
        result.values!.fundingApprovalId,
        simpleReportId
      )
    })
  }

  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}/reports/${simpleReportId}`)
}

export type FinaliseReportAndDownloadState = {
  error?: string
  success?: boolean
  newReportId?: string
  pdfBase64?: string
  filename?: string
}

export async function finaliseReportAndDownloadAction(
  clientId: string,
  existingDraftReportId: string | null,
  previousVersionId: string | null,
  _prevState: FinaliseReportAndDownloadState,
  formData: FormData
): Promise<FinaliseReportAndDownloadState> {
  const context = await requirePractitionerContext()

  const result = await parseReportForm(
    clientId,
    context.practiceId,
    context.practitionerProfileId,
    formData
  )
  if (result.error || !result.values) {
    return { error: result.error ?? "Unable to finalise report." }
  }

  const { simpleReportId } = await commitReportFinalise({
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId: context.practitionerProfileId,
    userId: context.userId,
    existingDraftReportId,
    previousVersionId,
    values: result.values,
  })

  if (result.values.reportRequirementId && result.values.fundingApprovalId) {
    await db.transaction(async (tx) => {
      await linkReportToRequirement(
        tx,
        result.values!.reportRequirementId,
        result.values!.fundingApprovalId,
        simpleReportId
      )
    })
  }

  const buffer = await generateReportPdf(result.values.snapshot)
  const filename = `${result.values.reportDate}_Confidential_${result.values.snapshot.reportTitle.replace(/\s+/g, "_")}.pdf`

  return {
    success: true,
    newReportId: simpleReportId,
    pdfBase64: buffer.toString("base64"),
    filename,
  }
}
