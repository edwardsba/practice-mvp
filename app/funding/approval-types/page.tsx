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
import { getFundingApprovalTypes } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"

export default async function FundingApprovalTypesPage() {
  const context = await requirePractitionerContext()
  const types = await getFundingApprovalTypes(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Funding approval types
        </h1>
        <Button asChild>
          <Link href="/funding/approval-types/new">
            Add Funding Approval Type
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Claim type</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Duration (months)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-muted-foreground"
                >
                  No funding approval types yet.
                </TableCell>
              </TableRow>
            ) : (
              types.map((type) => (
                <TableRow key={type.fundingApprovalTypeId}>
                  <TableCell>
                    <Link
                      href={`/funding/approval-types/${type.fundingApprovalTypeId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {type.name}
                    </Link>
                  </TableCell>
                  <TableCell>{type.claimTypeName ?? "—"}</TableCell>
                  <TableCell>{type.appointmentsApproved ?? "—"}</TableCell>
                  <TableCell>{type.durationMonths ?? "No limit"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
