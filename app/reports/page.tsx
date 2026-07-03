import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatClientNameLastFirst } from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"
import { formatDisplayDate } from "@/lib/funding/format"
import { loadReportsForPractice } from "@/lib/reports/load"
import { formatReportType } from "@/lib/reports/snapshot"

export default async function AllReportsPage() {
  const context = await requirePractitionerContext()
  const reports = await loadReportsForPractice(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
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
                  colSpan={5}
                  className="h-20 text-center text-muted-foreground"
                >
                  No reports yet.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => {
                const clientName = formatClientNameLastFirst(
                  report.clientFirstName,
                  report.clientLastName
                )
                const href = `/clients/${report.clientId}/reports/${report.simpleReportId}`
                const fundingApprovalLabel = report.fundingApprovalTypeName
                  ? `${report.fundingApprovalTypeName} - ${
                      report.fundingApprovalStartDate
                        ? formatDisplayDate(report.fundingApprovalStartDate)
                        : "—"
                    }`
                  : "—"

                return (
                  <TableRow
                    key={report.simpleReportId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={href} className="block font-medium">
                        {clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="block text-sm">
                        {report.reportDate
                          ? formatDisplayDate(String(report.reportDate))
                          : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="block">
                        {formatReportType(report.reportTypeName)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="block">
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
                      <Link href={href} className="block text-sm">
                        {fundingApprovalLabel}
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
