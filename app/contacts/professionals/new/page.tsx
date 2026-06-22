import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ProfessionalForm } from "@/components/contacts/professional-form"
import {
  getProfessionalOrganisations,
  getProfessions,
  saveProfessionalAction,
} from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  const context = await requirePractitionerContext()
  const [professions, organisations] = await Promise.all([
    getProfessions(context.practiceId),
    getProfessionalOrganisations(context.practiceId),
  ])

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={returnTo ?? "/contacts/professionals"}
          label="← Back"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add professional
        </h1>
      </div>

      <ProfessionalForm
        action={saveProfessionalAction.bind(
          null,
          context.practiceId,
          undefined,
          returnTo ?? null
        )}
        professions={professions}
        organisations={organisations}
        submitLabel="Save professional"
        cancelHref={returnTo ?? "/contacts/professionals"}
      />
    </AppShell>
  )
}
