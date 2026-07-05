import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

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
import { clients } from "@/db/schema"
import { getClaimsByClientId } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDisplayDate } from "@/lib/funding/format"

export default async function ClientClaimsPage({
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

  const claims = await getClaimsByClientId(clientId)
  const clientName = `${client.firstName} ${client.lastName}`
  const returnTo = `/clients/${clientId}/claims`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← {clientName}</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Claims — {clientName}
          </h1>
          <Button asChild>
            <Link
              href={`/funding/claims/new?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`}
            >
              Add Claim
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim type</TableHead>
              <TableHead>Start date</TableHead>
              <TableHead>End date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-20 text-center text-muted-foreground"
                >
                  No claims yet.
                </TableCell>
              </TableRow>
            ) : (
              claims.map((claim) => (
                <TableRow key={claim.claimId} className="hover:bg-muted/50">
                  <TableCell>
                    <Link
                      href={`/funding/claims/${claim.claimId}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="block font-medium text-primary hover:underline"
                    >
                      {claim.claimTypeName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/funding/claims/${claim.claimId}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="block hover:underline"
                    >
                      {formatDisplayDate(claim.startDate)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/funding/claims/${claim.claimId}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="block hover:underline"
                    >
                      {formatDisplayDate(claim.endDate)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
