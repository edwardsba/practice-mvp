import Link from "next/link"

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
import { getFundingApprovals } from "@/lib/actions/funding"
import { formatDisplayDate } from "@/lib/funding/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function FundingApprovalsPage() {
  const context = await requirePractitionerContext()
  const approvals = await getFundingApprovals(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Funding approvals
        </h1>
        <Button asChild>
          <Link href="/funding/approvals/new">Add Funding Approval</Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Approval type</TableHead>
              <TableHead>Start date</TableHead>
              <TableHead>End date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-muted-foreground"
                >
                  No funding approvals yet.
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((approval) => (
                <TableRow key={approval.fundingApprovalId}>
                  <TableCell>
                    <Link
                      href={`/funding/approvals/${approval.fundingApprovalId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {approval.clientLastName}, {approval.clientFirstName}
                    </Link>
                  </TableCell>
                  <TableCell>{approval.approvalTypeName ?? "—"}</TableCell>
                  <TableCell>{formatDisplayDate(approval.startDate)}</TableCell>
                  <TableCell>{formatDisplayDate(approval.endDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
