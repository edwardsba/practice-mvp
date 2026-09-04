import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { SageSrDiagnosticReportEditor } from "@/app/clients/[client_id]/reports/sage-sr/[report_id]/sage-sr-diagnostic-report-editor"
import { AppShell } from "@/components/app-shell"
import { SageSrDiagnosticReportContentView } from "@/components/report/sage-sr-diagnostic-report-content-view"
import { SageSrReportActionsToolbar } from "@/components/report/sage-sr-report-actions-toolbar"
import { BackButton } from "@/components/ui/back-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { clients, sageSrDiagnosticReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { formatDisplayDate } from "@/lib/funding/format"
import { resolveSageSrDiagnosticReportContent } from "@/lib/reports/generate-sage-sr-diagnostic-pdf"
import { REPORT_TEMPLATE_LABELS } from "@/lib/reports/templates"
import { REPORT_STATUS_CONFIG } from "@/lib/status"

import "@/components/report/report-print.css"

/**
 * Saved-report view for a SAGE-SR Diagnostic Report. Drafts render the editable
 * working copy (editedContentJson seeded from generatedContentJson at save time);
 * finalised reports are read-only and expose Download PDF / Send Report. There is
 * still no edit-after-finalise / new-version flow for this report type.
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
      editedContentJson: sageSrDiagnosticReports.editedContentJson,
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

  const content = resolveSageSrDiagnosticReportContent(
    report.editedContentJson,
    report.generatedContentJson
  )
  if (!content) {
    notFound()
  }

  const clientName = `${client.firstName} ${client.lastName}`
  const reportTitle = REPORT_TEMPLATE_LABELS.sage_sr_diagnostic
  const isFinalised = report.reportStatus === "finalised"
  const reportsListUrl = `/clients/${clientId}/reports`

  const emailContext = isFinalised
    ? await getQuestionnaireEmailContext(
        context.practiceId,
        context.practitionerProfileId
      )
    : null

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={reportsListUrl}
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
          actionRow={
            isFinalised ? (
              <SageSrReportActionsToolbar
                reportId={reportId}
                templateVariables={{
                  recipient_name: "Colleague",
                  client_name: clientName,
                  report_title: reportTitle,
                  report_title_lower: reportTitle.toLowerCase(),
                  practice_name: emailContext?.practiceName ?? "your practice",
                  practitioner_name:
                    emailContext?.practitionerName ?? "your practitioner",
                }}
              />
            ) : undefined
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

      {isFinalised ? (
        <div id="report-print-area" className="report-print-area">
          <div className="rounded-xl border bg-white p-8 shadow-sm">
            <SageSrDiagnosticReportContentView
              title={reportTitle}
              content={content}
              showNoPdfCaveat={false}
            />
          </div>
        </div>
      ) : (
        <SageSrDiagnosticReportEditor
          clientId={clientId}
          reportId={reportId}
          title={reportTitle}
          initialContent={content}
          cancelHref={reportsListUrl}
        />
      )}
    </AppShell>
  )
}
