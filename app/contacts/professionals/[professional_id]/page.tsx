import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getProfessionalById } from "@/lib/actions/contacts"
import {
  formatOrganisationAddress,
  formatProfessionalName,
} from "@/lib/contacts/format"

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ professional_id: string }>
}) {
  const { professional_id: professionalId } = await params
  const data = await getProfessionalById(professionalId)

  if (!data) {
    notFound()
  }

  const { professional, organisationLinks, referrals } = data
  const displayName = formatProfessionalName(
    professional.title,
    professional.firstName,
    professional.lastName
  )

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/contacts/professionals"
          label="← Back to professionals"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {displayName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {professional.professionName ?? "No profession set"}
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Details</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contacts/professionals/${professionalId}/edit`}>
              Edit
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">{displayName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Profession</dt>
              <dd className="font-medium">
                {professional.professionName ?? "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Organisations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {organisationLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No linked organisations.
            </p>
          ) : (
            organisationLinks.map((link) => (
              <div
                key={link.linkId}
                className="rounded-lg border p-4 grid gap-3 sm:grid-cols-2"
              >
                <div>
                  <p className="text-sm text-muted-foreground">Organisation</p>
                  <Link
                    href={`/contacts/organisations/${link.organisationId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {link.organisationName}
                  </Link>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="text-sm">
                    {formatOrganisationAddress(
                      link.streetAddress,
                      link.postalAddress
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Medicare provider no.
                  </p>
                  <p className="text-sm">
                    {link.medicareProviderNumber ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Secure messaging
                  </p>
                  <p className="text-sm">
                    {link.directSecureMessaging ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Direct phone</p>
                  <p className="text-sm">{link.directPhone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Direct email</p>
                  <p className="text-sm">{link.directEmail ?? "—"}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date start</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Claim type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No linked referrals yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  referrals.map((referral, index) => (
                    <TableRow key={index}>
                      <TableCell>{referral.dateStart}</TableCell>
                      <TableCell>
                        {referral.clientLastName}, {referral.clientFirstName}
                      </TableCell>
                      <TableCell>{referral.claimType}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
