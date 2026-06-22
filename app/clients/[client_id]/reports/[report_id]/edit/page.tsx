import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { EditReportForm } from "@/app/clients/[client_id]/reports/[report_id]/edit/edit-report-form"
import { deleteSimpleReport } from "@/app/clients/[client_id]/reports/[report_id]/edit/actions"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { clients, simpleReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function EditReportPage({
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
      reportStatus: simpleReports.reportStatus,
      dateRangeStart: simpleReports.dateRangeStart,
      dateRangeEnd: simpleReports.dateRangeEnd,
      clinicalSummaryText: simpleReports.clinicalSummaryText,
      recommendationsText: simpleReports.recommendationsText,
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
    notFound()
  }

  if (report.reportStatus === "finalised") {
    redirect(`/clients/${clientId}/reports/${reportId}`)
  }

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}/reports/${reportId}`}
          label="← Back to report"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Edit report</h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <EditReportForm
        clientId={clientId}
        reportId={reportId}
        initial={{
          dateRangeStart: report.dateRangeStart,
          dateRangeEnd: report.dateRangeEnd,
          clinicalSummaryText: report.clinicalSummaryText,
          recommendationsText: report.recommendationsText,
        }}
      />

      <EntityDeleteSection
        entityName="Report"
        deleteAction={deleteSimpleReport.bind(
          null,
          reportId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
