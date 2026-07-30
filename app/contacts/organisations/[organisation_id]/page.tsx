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
import { getProfessionalOrganisationById } from "@/lib/actions/contacts"
import { formatProfessionalName } from "@/lib/contacts/format"

export default async function OrganisationDetailPage({
  params,
}: {
  params: Promise<{ organisation_id: string }>
}) {
  const { organisation_id: organisationId } = await params
  const data = await getProfessionalOrganisationById(organisationId)

  if (!data) {
    notFound()
  }

  const { organisation, linkedProfessionals } = data

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/contacts/organisations"
          label="← Back to organisations"
        />
      </div>
      <EntityPageHeader
        kicker="Professional organisation"
        name={organisation.organisationName}
        subheading={organisation.organisationType ?? "No organisation type set"}
        subheadingAction={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contacts/organisations/${organisationId}/edit`}>
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
              <dt className="text-sm text-muted-foreground">Organisation name</dt>
              <dd className="font-medium">{organisation.organisationName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Organisation type</dt>
              <dd className="font-medium">
                {organisation.organisationType ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Phone</dt>
              <dd className="font-medium">{organisation.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Fax</dt>
              <dd className="font-medium">{organisation.fax ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Fax email</dt>
              <dd className="font-medium">{organisation.faxEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="font-medium">{organisation.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Secure messaging</dt>
              <dd className="font-medium">
                {organisation.secureMessaging ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Website</dt>
              <dd className="font-medium">{organisation.website ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Street address</dt>
              <dd className="font-medium">
                {organisation.streetAddress ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Postal address</dt>
              <dd className="font-medium">
                {organisation.postalAddress ?? "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked professionals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedProfessionals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No linked professionals.
                    </TableCell>
                  </TableRow>
                ) : (
                  linkedProfessionals.map((professional) => (
                    <TableRow key={professional.professionalId}>
                      <TableCell>
                        <Link
                          href={`/contacts/professionals/${professional.professionalId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {formatProfessionalName(
                            professional.title,
                            professional.firstName,
                            professional.lastName
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>{professional.directPhone ?? "—"}</TableCell>
                      <TableCell>{professional.directEmail ?? "—"}</TableCell>
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
