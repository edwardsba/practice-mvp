"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auditEvents, clients, sageSrDiagnosticReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { todayDateString } from "@/lib/appointments/format"
import {
  loadSageSrDiagnosticReportContentForClient,
  type SageSrDiagnosticReportContent,
  type SageSrDiagnosticReportSelectedInstances,
} from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"
import { resolveSageSrDiagnosticReportContent } from "@/lib/reports/generate-sage-sr-diagnostic-pdf"

/**
 * Server actions for the SAGE-SR Diagnostic Report composer (report-form.tsx's
 * isSageDiagnostic branch) and the saved-report editor. Deliberately separate from
 * report-form-actions.ts, which is entirely simple_reports/ReportSnapshot-shaped.
 * This report type writes to sage_sr_diagnostic_reports instead, per the confirmed
 * "own table, own renderer" design (db/schema/19-sage-sr-diagnostic-reports.ts).
 *
 * Save Draft creates the row (generated + edited content). Save as PDF on the
 * draft view finalises and locks it. PDF bytes are generated lazily on first
 * download or send, matching simple_reports.
 */

async function verifyClient(clientId: string, practiceId: string) {
  const [client] = await db
    .select({ clientId: clients.clientId })
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

function parseSelectedInstances(
  formData: FormData
): { error?: string; values?: SageSrDiagnosticReportSelectedInstances } {
  const core = String(formData.get("sage_core_instance_id") ?? "").trim()
  const background =
    String(formData.get("sage_background_instance_id") ?? "").trim() || null
  const personality =
    String(formData.get("sage_personality_instance_id") ?? "").trim() || null

  if (!core) {
    return { error: "Select a Core module import to build the report from." }
  }

  return { values: { core, background, personality } }
}

function parseEditedContent(
  raw: string
): SageSrDiagnosticReportContent | null {
  try {
    return resolveSageSrDiagnosticReportContent(JSON.parse(raw), null)
  } catch {
    return null
  }
}

/**
 * Fetches a live content preview as the practitioner changes which imports are
 * selected — called directly from report-form.tsx inside a transition, the same
 * plain-async-function pattern as fetchReportResultsForAppointments /
 * fetchReportResultsForRange in reports/actions.ts (not a useActionState form action;
 * nothing is saved here).
 */
export async function fetchSageDiagnosticReportPreview(
  clientId: string,
  selectedInstances: SageSrDiagnosticReportSelectedInstances
): Promise<{ content: SageSrDiagnosticReportContent | null; error?: string }> {
  const context = await requirePractitionerContext()

  const client = await verifyClient(clientId, context.practiceId)
  if (!client) {
    return { content: null, error: "Client not found." }
  }

  const result = await loadSageSrDiagnosticReportContentForClient(
    clientId,
    context.practiceId,
    selectedInstances,
    new Date()
  )
  if (!result.ok) {
    return { content: null, error: result.error }
  }

  return { content: result.content }
}

export interface SaveSageDiagnosticReportDraftState {
  error?: string
  success?: boolean
}

export async function saveSageDiagnosticReportDraftAction(
  clientId: string,
  _prevState: SaveSageDiagnosticReportDraftState,
  formData: FormData
): Promise<SaveSageDiagnosticReportDraftState> {
  const context = await requirePractitionerContext()

  const client = await verifyClient(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  const parsed = parseSelectedInstances(formData)
  if (parsed.error || !parsed.values) {
    return { error: parsed.error ?? "Could not read the selected imports." }
  }

  const reportDate =
    String(formData.get("report_date") ?? "").trim() || todayDateString()

  const result = await loadSageSrDiagnosticReportContentForClient(
    clientId,
    context.practiceId,
    parsed.values,
    new Date()
  )
  if (!result.ok) {
    return { error: result.error }
  }

  const editedContent = JSON.parse(
    JSON.stringify(result.content)
  ) as SageSrDiagnosticReportContent

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sageSrDiagnosticReports)
      .values({
        clientId,
        practiceId: context.practiceId,
        practitionerProfileId: context.practitionerProfileId,
        reportDate,
        selectedInstancesJson: parsed.values,
        generatedContentJson: result.content,
        editedContentJson: editedContent,
        reportStatus: "draft",
      })
      .returning({
        sageSrDiagnosticReportId: sageSrDiagnosticReports.sageSrDiagnosticReportId,
      })

    if (!row) {
      throw new Error("Failed to create SAGE-SR Diagnostic Report.")
    }

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "report.created",
      entityType: "sage_sr_diagnostic_report",
      entityId: row.sageSrDiagnosticReportId,
    })

    return row
  })

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/reports`)
  redirect(
    `/clients/${clientId}/reports/sage-sr/${inserted.sageSrDiagnosticReportId}`
  )
}

export interface FinaliseSageDiagnosticReportState {
  error?: string
}

export async function finaliseSageDiagnosticReportAction(
  clientId: string,
  reportId: string,
  _prevState: FinaliseSageDiagnosticReportState,
  formData: FormData
): Promise<FinaliseSageDiagnosticReportState> {
  const context = await requirePractitionerContext()

  const client = await verifyClient(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  const [report] = await db
    .select({
      sageSrDiagnosticReportId: sageSrDiagnosticReports.sageSrDiagnosticReportId,
      reportStatus: sageSrDiagnosticReports.reportStatus,
    })
    .from(sageSrDiagnosticReports)
    .where(
      and(
        eq(sageSrDiagnosticReports.sageSrDiagnosticReportId, reportId),
        eq(sageSrDiagnosticReports.clientId, clientId),
        eq(sageSrDiagnosticReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!report) {
    return { error: "Report not found." }
  }

  if (report.reportStatus === "finalised") {
    return { error: "This report has already been finalised." }
  }

  const edited = parseEditedContent(
    String(formData.get("edited_content_json") ?? "")
  )
  if (!edited) {
    return { error: "Could not read the edited report content." }
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(sageSrDiagnosticReports)
      .set({
        editedContentJson: edited,
        reportStatus: "finalised",
        finalisedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(sageSrDiagnosticReports.sageSrDiagnosticReportId, reportId),
          eq(sageSrDiagnosticReports.practiceId, context.practiceId)
        )
      )

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "report.finalised",
      entityType: "sage_sr_diagnostic_report",
      entityId: reportId,
    })
  })

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/reports`)
  revalidatePath(`/clients/${clientId}/reports/sage-sr/${reportId}`)
  redirect(`/clients/${clientId}/reports/sage-sr/${reportId}`)
}
