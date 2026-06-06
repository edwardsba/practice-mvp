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
import { getProfessionals } from "@/lib/actions/contacts"
import { formatOrganisationAddress } from "@/lib/contacts/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function ProfessionalsPage() {
  const context = await requirePractitionerContext()
  const professionals = await getProfessionals(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Professionals</h1>
        <Button asChild>
          <Link href="/contacts/professionals/new">Add Professional</Link>
        </Button>
      </div>

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
              professionals.map((professional) => (
                <TableRow key={professional.professionalId}>
                  <TableCell>
                    <Link
                      href={`/contacts/professionals/${professional.professionalId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {professional.lastName}, {professional.firstName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
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
                  </TableCell>
                  <TableCell>{professional.professionName ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
