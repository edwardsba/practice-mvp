import { AppShell } from "@/components/app-shell"
import { getPractitionerProfile } from "@/app/practitioner/actions"
import { PractitionerForm } from "@/app/practitioner/practitioner-form"

export default async function PractitionerPage() {
  const profile = await getPractitionerProfile()

  if (!profile) {
    return (
      <AppShell title="Practitioner Profile">
        <p className="text-muted-foreground">Practitioner profile not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell title="Practitioner Profile">
      <PractitionerForm profile={profile} />
    </AppShell>
  )
}
