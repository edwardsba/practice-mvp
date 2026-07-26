import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { OrganisationForm } from "@/components/contacts/organisation-form"
import { saveProfessionalOrganisationAction } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewOrganisationPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const context = await requirePractitionerContext()
  const { returnTo } = await searchParams

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/contacts/organisations"
          label="← Back to organisations"
        />
      </div>
      <ListPageHeader heading="Add organisation" />
      <OrganisationForm
        action={saveProfessionalOrganisationAction.bind(
          null,
          context.practiceId,
          undefined,
          returnTo ?? null
        )}
        submitLabel="Save organisation"
        cancelHref={returnTo ?? "/contacts/organisations"}
      />
    </AppShell>
  )
}
