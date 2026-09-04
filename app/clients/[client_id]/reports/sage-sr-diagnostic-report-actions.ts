"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { clients, sageSrDiagnosticReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { todayDateString } from "@/lib/appointments/format"
import {
  loadSageSrDiagnosticReportContentForClient,
  type SageSrDiagnosticReportContent,
  type SageSrDiagnosticReportSelectedInstances,
} from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"

/**
 * Server actions for the SAGE-SR Diagnostic Report composer (report-form.tsx's
 * isSageDiagnostic branch). Deliberately separate from report-form-actions.ts, which
 * is entirely simple_reports/ReportSnapshot-shaped (funding approvals, letter body,
 * PDFKit rendering via generateReportPdf) — none of which applies here. This report
 * type writes to sage_sr_diagnostic_reports instead, per the confirmed "own table, own
 * renderer" design decision (db/schema/19-sage-sr-diagnostic-reports.ts).
 *
 * Scope of this slice: draft creation only. There is no PDFKit renderer for this
 * report type yet (a separate follow-up), so there is no "Finalise" / download / send
 * step here to mirror report-form-actions.ts's finaliseReportAction family — Save
 * Draft is the only action, and it always creates a new row (no edit-existing-draft
 * flow yet). generatedContentJson is populated in full on every save so the
 * saved-report view at /clients/[client_id]/reports/sage-sr/[report_id] can render
 * the frozen snapshot immediately.
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

  const [inserted] = await db
    .insert(sageSrDiagnosticReports)
    .values({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      reportDate,
      selectedInstancesJson: parsed.values,
      generatedContentJson: result.content,
      reportStatus: "draft",
    })
    .returning({
      sageSrDiagnosticReportId: sageSrDiagnosticReports.sageSrDiagnosticReportId,
    })

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/reports`)
  redirect(
    `/clients/${clientId}/reports/sage-sr/${inserted.sageSrDiagnosticReportId}`
  )
}
