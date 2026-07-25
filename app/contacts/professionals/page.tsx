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
import { getProfessionals } from "@/lib/actions/contacts"
import { formatOrganisationAddress } from "@/lib/contacts/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function ProfessionalsPage() {
  const context = await requirePractitionerContext()
  const professionals = await getProfessionals(context.practiceId)

  return (
    <AppShell>
      <ListPageHeader
        heading="Professionals"
        action={
          <Button asChild>
            <Link href="/contacts/professionals/new">Add Professional</Link>
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Organisation(s)</TableHead>
              <TableHead>Profession</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {professionals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-20 text-center text-muted-foreground"
                >
                  No professionals yet.
                </TableCell>
              </TableRow>
            ) : (
              professionals.map((professional) => {
                const professionalHref = `/contacts/professionals/${professional.professionalId}`

                return (
                  <TableRow
                    key={professional.professionalId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={professionalHref} className="block font-medium text-primary hover:underline">
                        {professional.lastName}, {professional.firstName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={professionalHref} className="block text-sm text-muted-foreground">
                        {professional.organisations.length === 0
                          ? "—"
                          : professional.organisations.map((org, index) => (
                              <div key={`${org.name}-${index}`}>
                                {org.name}
                                {org.streetAddress || org.postalAddress ? (
                                  <span className="block text-xs">
                                    {formatOrganisationAddress(
                                      org.streetAddress,
                                      org.postalAddress
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={professionalHref} className="block">
                        {professional.professionName ?? "—"}
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
