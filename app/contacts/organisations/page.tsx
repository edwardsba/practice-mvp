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
import { getProfessionalOrganisations } from "@/lib/actions/contacts"
import { formatOrganisationAddress } from "@/lib/contacts/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function OrganisationsPage() {
  const context = await requirePractitionerContext()
  const organisations = await getProfessionalOrganisations(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Professional organisations
        </h1>
        <Button asChild>
          <Link href="/contacts/organisations/new">Add Organisation</Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Organisation type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organisations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-20 text-center text-muted-foreground"
                >
                  No organisations yet.
                </TableCell>
              </TableRow>
            ) : (
              organisations.map((organisation) => (
                <TableRow key={organisation.organisationId}>
                  <TableCell>
                    <Link
                      href={`/contacts/organisations/${organisation.organisationId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {organisation.organisationName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatOrganisationAddress(
                      organisation.streetAddress,
                      organisation.postalAddress
                    )}
                  </TableCell>
                  <TableCell>{organisation.organisationType ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
