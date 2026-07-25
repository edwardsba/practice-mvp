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
import { getProfessionalOrganisations } from "@/lib/actions/contacts"
import { formatOrganisationAddress } from "@/lib/contacts/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function OrganisationsPage() {
  const context = await requirePractitionerContext()
  const organisations = await getProfessionalOrganisations(context.practiceId)

  return (
    <AppShell>
      <ListPageHeader
        heading="Professional organisations"
        action={
          <Button asChild>
            <Link href="/contacts/organisations/new">Add Organisation</Link>
          </Button>
        }
      />

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
              organisations.map((organisation) => {
                const organisationHref = `/contacts/organisations/${organisation.organisationId}`

                return (
                  <TableRow
                    key={organisation.organisationId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={organisationHref} className="block font-medium text-primary hover:underline">
                        {organisation.organisationName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={organisationHref} className="block text-muted-foreground">
                        {formatOrganisationAddress(
                          organisation.streetAddress,
                          organisation.postalAddress
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={organisationHref} className="block">
                        {organisation.organisationType ?? "—"}
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
