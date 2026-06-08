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
import { getClaims } from "@/lib/actions/funding"
import { formatDisplayDate } from "@/lib/funding/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; client_id?: string }>
}) {
  const context = await requirePractitionerContext()
  const { clientId: clientIdCamel, client_id: clientIdSnake } =
    await searchParams
  const clientId = clientIdCamel ?? clientIdSnake
  const backHref = clientId ? `/clients/${clientId}` : "/clients"
  const claims = await getClaims(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={backHref}>← Back</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
          <Button asChild>
            <Link href="/funding/claims/new">Add Claim</Link>
          </Button>
        </div>
      </div>

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
              claims.map((claim) => (
                <TableRow key={claim.claimId}>
                  <TableCell>
                    <Link
                      href={`/funding/claims/${claim.claimId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {claim.clientLastName}, {claim.clientFirstName}
                    </Link>
                  </TableCell>
                  <TableCell>{claim.claimTypeName}</TableCell>
                  <TableCell>{formatDisplayDate(claim.startDate)}</TableCell>
                  <TableCell>{formatDisplayDate(claim.endDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
