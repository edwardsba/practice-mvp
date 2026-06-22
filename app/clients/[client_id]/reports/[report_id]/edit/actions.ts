"use server"

import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  buildSnapshot,
  fetchReportResultsForRange,
} from "@/app/clients/[client_id]/reports/actions"
import { auditEvents, simpleReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseReportSnapshot, resolveReportType } from "@/lib/reports/snapshot"

export type UpdateReportDraftState = {
  error?: string
}

export async function updateReportDraft(
  clientId: string,
  reportId: string,
  _prevState: UpdateReportDraftState,
  formData: FormData
): Promise<UpdateReportDraftState> {
  const context = await requirePractitionerContext()

  const [report] = await db
    .select({
      reportStatus: simpleReports.reportStatus,
      valuesSnapshotJson: simpleReports.valuesSnapshotJson,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.simpleReportId, reportId),
        eq(simpleReports.clientId, clientId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!report) {
    return { error: "Report not found." }
  }

  if (report.reportStatus === "finalised") {
    redirect(`/clients/${clientId}/reports/${reportId}`)
  }

  const dateRangeStart = String(formData.get("date_range_start") ?? "").trim()
  const dateRangeEnd = String(formData.get("date_range_end") ?? "").trim()
  const clinicalSummaryText =
    String(formData.get("clinical_summary_text") ?? "").trim() || null
  const recommendationsText =
    String(formData.get("recommendations_text") ?? "").trim() || null

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

  const existingSnapshot = parseReportSnapshot(report.valuesSnapshotJson)
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
    recommendationsText
  )

  if (!snapshot) {
    return { error: "Unable to save report. Client or practice not found." }
  }

  if (existingSnapshot?.generatedAt) {
    snapshot.generatedAt = existingSnapshot.generatedAt
  }

  const reportType = resolveReportType(
    preview.phq9Results.length,
    preview.gad7Results.length
  )
  const now = new Date()

  await db
    .update(simpleReports)
    .set({
      reportType,
      dateRangeStart,
      dateRangeEnd,
      valuesSnapshotJson: snapshot,
      clinicalSummaryText,
      recommendationsText,
      reportStatus: "draft",
      updatedAt: now,
    })
    .where(eq(simpleReports.simpleReportId, reportId))

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "report.updated",
    entityType: "simple_report",
    entityId: reportId,
  })

  revalidatePath(`/clients/${clientId}/reports/${reportId}`)
  revalidatePath(`/clients/${clientId}/reports/${reportId}/edit`)
  revalidatePath(`/clients/${clientId}`)

  redirect(`/clients/${clientId}/reports/${reportId}`)
}

export async function deleteSimpleReport(
  reportId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    return { error: "Unauthorized practice access." }
  }

  const [report] = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      clientId: simpleReports.clientId,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.simpleReportId, reportId),
        eq(simpleReports.practiceId, practiceId),
        ne(simpleReports.reportStatus, "deleted")
      )
    )
    .limit(1)

  if (!report) {
    return { error: "Report not found." }
  }

  try {
    await db
      .update(simpleReports)
      .set({ reportStatus: "deleted", updatedAt: new Date() })
      .where(eq(simpleReports.simpleReportId, reportId))

    await db.insert(auditEvents).values({
      practiceId,
      userId: context.userId,
      clientId: report.clientId,
      eventType: "report.deleted",
      entityType: "simple_report",
      entityId: reportId,
    })
  } catch {
    return { error: "Unable to delete report. Please try again." }
  }

  revalidatePath(`/clients/${report.clientId}/reports`)
  revalidatePath(`/clients/${report.clientId}`)
  redirect(`/clients/${report.clientId}/reports`)
}
