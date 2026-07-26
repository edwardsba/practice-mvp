import Link from "next/link"

import { AppShell } from "@/components/app-shell"
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
import { getClaims } from "@/lib/actions/funding"
import { formatDisplayDate } from "@/lib/funding/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function ClaimsPage() {
  const context = await requirePractitionerContext()
  const claims = await getClaims(context.practiceId)

  return (
    <AppShell>
      <ListPageHeader
        heading="Claims"
        action={
          <Button asChild>
            <Link href="/funding/claims/new">Add Claim</Link>
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Claim type</TableHead>
              <TableHead>Start date</TableHead>
              <TableHead>End date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-muted-foreground"
                >
                  No claims yet.
                </TableCell>
              </TableRow>
            ) : (
              claims.map((claim) => {
                const claimHref = `/funding/claims/${claim.claimId}`

                return (
                  <TableRow
                    key={claim.claimId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={claimHref} className="block font-medium text-primary hover:underline">
                        {claim.clientLastName}, {claim.clientFirstName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={claimHref} className="block">
                        {claim.claimTypeName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={claimHref} className="block">
                        {formatDisplayDate(claim.startDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={claimHref} className="block">
                        {formatDisplayDate(claim.endDate)}
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
