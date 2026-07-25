import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { OrganisationForm } from "@/components/contacts/organisation-form"
import {
  getProfessionalOrganisationById,
  saveProfessionalOrganisationAction,
  deleteOrganisation,
  getOrganisationDeleteStatus,
} from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"
import { EntityDeleteSection } from "@/components/entity-delete-section"

export default async function EditOrganisationPage({
  params,
}: {
  params: Promise<{ organisation_id: string }>
}) {
  const { organisation_id: organisationId } = await params
  const context = await requirePractitionerContext()
  const data = await getProfessionalOrganisationById(organisationId)

  if (!data) {
    notFound()
  }

  const { organisation } = data
  const deleteStatus = await getOrganisationDeleteStatus(organisationId)

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/contacts/organisations/${organisationId}`}>← Back</Link>
        </Button>
      </div>
      <EntityPageHeader
        kicker="Professional organisation edit"
        name={organisation.organisationName}
      />

      <OrganisationForm
        action={saveProfessionalOrganisationAction.bind(
          null,
          context.practiceId,
          organisationId,
          null
        )}
        initialValues={{
          organisationName: organisation.organisationName,
          organisationType: organisation.organisationType,
          streetAddress: organisation.streetAddress,
          postalAddress: organisation.postalAddress,
          phone: organisation.phone,
          fax: organisation.fax,
          faxEmail: organisation.faxEmail,
          email: organisation.email,
          claimsEmail: organisation.claimsEmail,
          secureMessaging: organisation.secureMessaging,
          website: organisation.website,
        }}
        submitLabel="Save organisation"
        cancelHref={`/contacts/organisations/${organisationId}`}
      />

      <EntityDeleteSection
        entityName="Organisation"
        blockedReason={deleteStatus.blockedReason}
        deleteAction={deleteOrganisation.bind(
          null,
          organisationId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
