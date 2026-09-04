import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { SageSrDiagnosticReportContentView } from "@/components/report/sage-sr-diagnostic-report-content-view"
import { BackButton } from "@/components/ui/back-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { clients, sageSrDiagnosticReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import type { SageSrDiagnosticReportContent } from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"
import { db } from "@/lib/db"
import { formatDisplayDate } from "@/lib/funding/format"
import { REPORT_TEMPLATE_LABELS } from "@/lib/reports/templates"
import { REPORT_STATUS_CONFIG } from "@/lib/status"

import "@/components/report/report-print.css"

/**
 * Saved-report view for a SAGE-SR Diagnostic Report — the follow-up flagged in this
 * feature's handover ("Reports list + saved-report view are not SAGE-SR-aware yet").
 * Deliberately its own route (sage-sr/[report_id], not the existing [report_id]
 * route), since a SAGE-SR row lives in sage_sr_diagnostic_reports, not simple_reports,
 * and its own id namespace — reusing [report_id] would either collide with that
 * route's simple_reports lookup or require threading a report-kind flag through it.
 *
 * Read-only, same as the composer's live preview: renders generatedContentJson (the
 * frozen snapshot taken at save time) via the shared SageSrDiagnosticReportContentView.
 * There is no edit-existing-draft flow and no PDFKit renderer yet (both explicit
 * follow-ups of their own), so there is nothing to link to here beyond the reports
 * list — no "Continue editing", no download/send actions.
 */
export default async function SavedSageSrDiagnosticReportPage({
  params,
}: {
  params: Promise<{ client_id: string; report_id: string }>
}) {
  const { client_id: clientId, report_id: reportId } = await params
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    notFound()
  }

  const [report] = await db
    .select({
      sageSrDiagnosticReportId: sageSrDiagnosticReports.sageSrDiagnosticReportId,
      reportStatus: sageSrDiagnosticReports.reportStatus,
      reportDate: sageSrDiagnosticReports.reportDate,
      versionNumber: sageSrDiagnosticReports.versionNumber,
      isCurrentVersion: sageSrDiagnosticReports.isCurrentVersion,
      generatedContentJson: sageSrDiagnosticReports.generatedContentJson,
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
    notFound()
  }

  // generatedContentJson is always populated by saveSageDiagnosticReportDraftAction at
  // save time (see sage-sr-diagnostic-report-actions.ts) — a row with none on file is
  // unexpected, not a valid empty state, so treat it the same as "report not found"
  // rather than rendering a blank page.
  const content = report.generatedContentJson as SageSrDiagnosticReportContent | null
  if (!content) {
    notFound()
  }

  const clientName = `${client.firstName} ${client.lastName}`
  const reportTitle = REPORT_TEMPLATE_LABELS.sage_sr_diagnostic

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={`/clients/${clientId}/reports`}
          label="← Back to client"
        />
      </div>
      <div className="no-print">
        <EntityPageHeader
          kicker="Report"
          name={clientName}
          subheading={reportTitle}
          badge={
            <StatusBadge
              status={report.reportStatus}
              statusMap={REPORT_STATUS_CONFIG}
            />
          }
        />
      </div>

      <Card className="no-print mb-6">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Report date</dt>
              <dd className="font-medium">
                {formatDisplayDate(report.reportDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Report status</dt>
              <dd className="text-sm text-muted-foreground">
                Version {report.versionNumber}
                {report.isCurrentVersion ? " · Current" : " · Superseded"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div id="report-print-area" className="report-print-area">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <SageSrDiagnosticReportContentView title={reportTitle} content={content} />
        </div>
      </div>
    </AppShell>
  )
}
