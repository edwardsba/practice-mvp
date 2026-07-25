import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getFundingApprovals } from "@/lib/actions/funding"
import { formatApprovalProgress, formatDisplayDate } from "@/lib/funding/format"
import { REPORTING_OVERALL_STATUS_CONFIG } from "@/lib/funding/reporting-status"
import { requirePractitionerContext } from "@/lib/auth"

export default async function FundingApprovalsPage() {
  const context = await requirePractitionerContext()
  const approvals = await getFundingApprovals(context.practiceId)

  return (
    <AppShell>
      <ListPageHeader
        heading="Funding approvals"
        action={
          <Button asChild>
            <Link href="/funding/approvals/new">Add Funding Approval</Link>
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Approval type</TableHead>
              <TableHead>Start date</TableHead>
              <TableHead>End date</TableHead>
              <TableHead>Reporting</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-20 text-center text-muted-foreground"
                >
                  No funding approvals yet.
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((approval) => {
                const approvalHref = `/funding/approvals/${approval.fundingApprovalId}`

                return (
                  <TableRow
                    key={approval.fundingApprovalId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={approvalHref} className="block font-medium text-primary hover:underline">
                        {approval.clientLastName}, {approval.clientFirstName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={approvalHref} className="block">
                        {approval.approvalTypeName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={approvalHref} className="block">
                        {formatDisplayDate(approval.startDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={approvalHref} className="block">
                        {formatDisplayDate(approval.endDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={approvalHref} className="block">
                        {approval.reportingOverallStatus ? (
                          <StatusBadge
                            status={approval.reportingOverallStatus}
                            statusMap={REPORTING_OVERALL_STATUS_CONFIG}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={approvalHref} className="block">
                        {formatApprovalProgress(
                          approval.appointmentsAttended,
                          approval.appointmentsApproved
                        )}
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
