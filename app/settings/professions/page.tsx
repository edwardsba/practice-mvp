import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
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
        <h1 className="text-2xl font-semibold tracking-tight">Professions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage profession types used for professionals and referrers.
        </p>
      </div>

      <ProfessionsManager
        practiceId={context.practiceId}
        professions={professions}
      />
    </AppShell>
  )
}
