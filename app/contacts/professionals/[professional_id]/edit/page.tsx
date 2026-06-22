import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { ProfessionalForm } from "@/components/contacts/professional-form"
import {
  getProfessionalById,
  getProfessionalOrganisations,
  getProfessions,
  saveProfessionalAction,
  deleteProfessional,
  getProfessionalDeleteStatus,
} from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"
import { EntityDeleteSection } from "@/components/entity-delete-section"

export default async function EditProfessionalPage({
  params,
}: {
  params: Promise<{ professional_id: string }>
}) {
  const { professional_id: professionalId } = await params
  const context = await requirePractitionerContext()

  const [data, professions, organisations] = await Promise.all([
    getProfessionalById(professionalId),
    getProfessions(context.practiceId),
    getProfessionalOrganisations(context.practiceId),
  ])

  if (!data) {
    notFound()
  }

  const deleteStatus = await getProfessionalDeleteStatus(professionalId)

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/contacts/professionals/${professionalId}`}>← Back</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit professional
        </h1>
      </div>

      <ProfessionalForm
        action={saveProfessionalAction.bind(
          null,
          context.practiceId,
          professionalId,
          null
        )}
        professionalId={professionalId}
        professions={professions}
        organisations={organisations}
        initialValues={{
          title: data.professional.title,
          firstName: data.professional.firstName,
          lastName: data.professional.lastName,
          professionId: data.professional.professionId,
          organisationLinks: data.organisationLinks.map((link) => ({
            linkId: link.linkId,
            organisationId: link.organisationId,
            medicareProviderNumber: link.medicareProviderNumber,
            directPhone: link.directPhone,
            directEmail: link.directEmail,
            directSecureMessaging: link.directSecureMessaging,
          })),
        }}
        submitLabel="Save professional"
        cancelHref={`/contacts/professionals/${professionalId}`}
      />

      <EntityDeleteSection
        entityName="Professional"
        blockedReason={deleteStatus.blockedReason}
        deleteAction={deleteProfessional.bind(
          null,
          professionalId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
