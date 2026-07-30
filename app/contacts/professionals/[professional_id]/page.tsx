import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
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
import { formatDisplayDate } from "@/lib/funding/format"

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
      </div>
      <EntityPageHeader
        kicker="Professional"
        name={displayName}
        subheading={professional.professionName ?? "No profession set"}
        subheadingAction={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contacts/professionals/${professionalId}/edit`}>
              Edit
            </Link>
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Approval type</TableHead>
                  <TableHead>Claim type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No linked referrals yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  referrals.map((referral) => {
                    const clientHref = `/clients/${referral.clientId}`
                    return (
                      <TableRow
                        key={referral.fundingApprovalId}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>
                          <Link href={clientHref} className="block">
                            {referral.dateStart
                              ? formatDisplayDate(referral.dateStart)
                              : "—"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={clientHref}
                            className="block font-medium text-primary hover:underline"
                          >
                            {referral.clientLastName}, {referral.clientFirstName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={clientHref} className="block">
                            {referral.approvalTypeName ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={clientHref} className="block">
                            {referral.claimType ?? "—"}
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
