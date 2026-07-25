import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { ProfessionsManager } from "@/components/contacts/professions-manager"
import { getProfessions } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"

export default async function ProfessionsSettingsPage() {
  const context = await requirePractitionerContext()
  const professions = await getProfessions(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practice" label="← Back to practice" />
      </div>
      <ListPageHeader heading="Professions" />

      <ProfessionsManager
        practiceId={context.practiceId}
        professions={professions}
      />
    </AppShell>
  )
}
