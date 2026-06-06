import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { OrganisationForm } from "@/components/contacts/organisation-form"
import { saveProfessionalOrganisationAction } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewOrganisationPage() {
  const context = await requirePractitionerContext()

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/contacts/organisations"
          label="← Back to organisations"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add organisation
        </h1>
      </div>

      <OrganisationForm
        action={saveProfessionalOrganisationAction.bind(
          null,
          context.practiceId,
          undefined
        )}
        submitLabel="Save organisation"
        cancelHref="/contacts/organisations"
      />
    </AppShell>
  )
}
