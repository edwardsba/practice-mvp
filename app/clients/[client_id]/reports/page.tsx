import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq, ne } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  clients,
  fundingApprovals,
  fundingApprovalTypes,
  reportTypes,
  sageSrDiagnosticReports,
  simpleReports,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDisplayDate } from "@/lib/funding/format"
import { formatReportType } from "@/lib/reports/snapshot"
import { REPORT_TEMPLATE_LABELS } from "@/lib/reports/templates"

/**
 * One row of the merged reports list, regardless of which table it actually comes
 * from. simple_reports and sage_sr_diagnostic_reports are deliberately separate
 * tables (see db/schema/19-sage-sr-diagnostic-reports.ts's docstring), but the
 * practitioner just sees "this client's reports" as one list, so the two are fetched
 * separately and merged here rather than forcing a UNION or a shared schema on them.
 */
type ClientReportRow = {
  id: string
  kind: "simple" | "sage_sr"
  reportTypeLabel: string
  reportStatus: string
  reportDate: string | null
  createdAt: Date
  fundingApprovalLabel: string
}

export default async function ClientReportsPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
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

  const simpleReportRows = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      reportTypeName: reportTypes.name,
      reportStatus: simpleReports.reportStatus,
      reportDate: simpleReports.reportDate,
      createdAt: simpleReports.createdAt,
      fundingApprovalTypeName: fundingApprovalTypes.name,
      fundingApprovalStartDate: fundingApprovals.startDate,
    })
    .from(simpleReports)
    .leftJoin(
      reportTypes,
      eq(simpleReports.reportTypeId, reportTypes.reportTypeId)
    )
    .leftJoin(
      fundingApprovals,
      eq(simpleReports.fundingApprovalId, fundingApprovals.fundingApprovalId)
    )
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .where(
      and(
        eq(simpleReports.clientId, clientId),
        eq(simpleReports.practiceId, context.practiceId),
        eq(simpleReports.isCurrentVersion, true),
        ne(simpleReports.reportStatus, "deleted")
      )
    )

  const sageSrReportRows = await db
    .select({
      sageSrDiagnosticReportId: sageSrDiagnosticReports.sageSrDiagnosticReportId,
      reportStatus: sageSrDiagnosticReports.reportStatus,
      reportDate: sageSrDiagnosticReports.reportDate,
      createdAt: sageSrDiagnosticReports.createdAt,
    })
    .from(sageSrDiagnosticReports)
    .where(
      and(
        eq(sageSrDiagnosticReports.clientId, clientId),
        eq(sageSrDiagnosticReports.practiceId, context.practiceId),
        eq(sageSrDiagnosticReports.isCurrentVersion, true)
      )
    )

  const reports: ClientReportRow[] = [
    ...simpleReportRows.map((row): ClientReportRow => {
      const fundingApprovalLabel = row.fundingApprovalTypeName
        ? `${row.fundingApprovalTypeName} - ${
            row.fundingApprovalStartDate
              ? formatDisplayDate(row.fundingApprovalStartDate)
              : "—"
          }`
        : "—"
      return {
        id: row.simpleReportId,
        kind: "simple",
        reportTypeLabel: formatReportType(row.reportTypeName),
        reportStatus: row.reportStatus,
        reportDate: row.reportDate,
        createdAt: row.createdAt,
        fundingApprovalLabel,
      }
    }),
    ...sageSrReportRows.map(
      (row): ClientReportRow => ({
        id: row.sageSrDiagnosticReportId,
        kind: "sage_sr",
        reportTypeLabel: REPORT_TEMPLATE_LABELS.sage_sr_diagnostic,
        reportStatus: row.reportStatus,
        reportDate: row.reportDate,
        createdAt: row.createdAt,
        fundingApprovalLabel: "—",
      })
    ),
  ].sort((a, b) => {
    // Mirrors the previous single-query orderBy(desc(reportDate), desc(createdAt)) —
    // done in JS now that two tables are merged. Null reportDate sorts last.
    if (a.reportDate !== b.reportDate) {
      if (!a.reportDate) return 1
      if (!b.reportDate) return -1
      return a.reportDate < b.reportDate ? 1 : -1
    }
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  const clientName = `${client.firstName} ${client.lastName}`
  const reportsListUrl = `/clients/${clientId}/reports`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label={`← ${clientName}`}
        />
      </div>
      <EntityPageHeader
        kicker="Reports"
        name={clientName}
        subheading={`${reports.length} report${reports.length === 1 ? "" : "s"}`}
        action={
          <Button asChild>
            <Link
              href={`/clients/${clientId}/reports/new?returnTo=${encodeURIComponent(reportsListUrl)}`}
            >
              Create Report
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Funding Approval</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-muted-foreground"
                >
                  No reports yet.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => {
                const reportPath =
                  report.kind === "sage_sr"
                    ? `/clients/${clientId}/reports/sage-sr/${report.id}`
                    : `/clients/${clientId}/reports/${report.id}`
                const reportHref = `${reportPath}?returnTo=${encodeURIComponent(reportsListUrl)}`

                return (
                  <TableRow
                    key={`${report.kind}-${report.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={reportHref}
                        className="block font-medium text-primary hover:underline"
                      >
                        {report.reportDate
                          ? formatDisplayDate(report.reportDate)
                          : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={reportHref} className="block hover:underline">
                        {report.reportTypeLabel}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={reportHref} className="block">
                        <Badge
                          variant={
                            report.reportStatus === "finalised"
                              ? "success"
                              : "outline"
                          }
                        >
                          {report.reportStatus === "finalised"
                            ? "Finalised"
                            : "Draft"}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={reportHref} className="block text-sm">
                        {report.fundingApprovalLabel}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
