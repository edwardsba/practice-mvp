import Link from "next/link"
import { notFound } from "next/navigation"
import { and, desc, eq, ne } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { clients, reportTypes, simpleReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDisplayDate } from "@/lib/funding/format"
import { formatReportType } from "@/lib/reports/snapshot"

function formatReportDateRange(start: string, end: string) {
  const formatPart = (value: string) => {
    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return `${formatPart(start)} – ${formatPart(end)}`
}

function formatReportStatus(status: string) {
  if (status === "draft") return "Draft"
  if (status === "finalised") return "Finalised"
  return status.charAt(0).toUpperCase() + status.slice(1)
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

  const reports = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      reportTypeName: reportTypes.name,
      templateKey: reportTypes.templateKey,
      reportStatus: simpleReports.reportStatus,
      reportDate: simpleReports.reportDate,
      dateRangeStart: simpleReports.dateRangeStart,
      dateRangeEnd: simpleReports.dateRangeEnd,
    })
    .from(simpleReports)
    .leftJoin(
      reportTypes,
      eq(simpleReports.reportTypeId, reportTypes.reportTypeId)
    )
    .where(
      and(
        eq(simpleReports.clientId, clientId),
        eq(simpleReports.practiceId, context.practiceId),
        ne(simpleReports.reportStatus, "deleted")
      )
    )
    .orderBy(desc(simpleReports.reportDate), desc(simpleReports.createdAt))

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← {clientName}</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Reports — {clientName}
          </h1>
          <Button asChild>
            <Link href={`/clients/${clientId}/reports/new`}>Create Report</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report date</TableHead>
              <TableHead>Report type</TableHead>
              <TableHead>Date range</TableHead>
              <TableHead>Status</TableHead>
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
                const reportHref = `/clients/${clientId}/reports/${report.simpleReportId}`
                return (
                  <TableRow
                    key={report.simpleReportId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={reportHref}
                        className="block font-medium text-primary hover:underline"
                      >
                        {report.reportDate
                          ? formatDisplayDate(String(report.reportDate))
                          : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={reportHref} className="block hover:underline">
                        {formatReportType(report.reportTypeName)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={reportHref} className="block hover:underline">
                        {report.templateKey === "referral_acknowledgement"
                          ? "—"
                          : report.dateRangeStart && report.dateRangeEnd
                            ? formatReportDateRange(
                                String(report.dateRangeStart),
                                String(report.dateRangeEnd)
                              )
                            : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={reportHref} className="block hover:underline">
                        {formatReportStatus(report.reportStatus)}
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
