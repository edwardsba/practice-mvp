import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { SavedReportView } from "@/app/clients/[client_id]/reports/[report_id]/saved-report-view"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { clients, simpleReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseReportSnapshot } from "@/lib/reports/snapshot"

// Print CSS kept for browser preview; PDF is generated server-side
import "@/components/report/report-print.css"

export default async function SavedReportPage({
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
      simpleReportId: simpleReports.simpleReportId,
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
    notFound()
  }

  const snapshot = parseReportSnapshot(report.valuesSnapshotJson)
  if (!snapshot) {
    notFound()
  }

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <h1 className="text-2xl font-semibold tracking-tight">{clientName}</h1>
        <p className="mt-1 text-muted-foreground">{snapshot.reportTitle}</p>
      </div>

      <SavedReportView
        clientId={clientId}
        reportId={reportId}
        reportStatus={report.reportStatus}
        snapshot={snapshot}
      />
    </AppShell>
  )
}
