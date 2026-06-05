import Link from "next/link"

import { getPractitionerProfile } from "@/app/practitioner/actions"
import { PractitionerForm } from "@/app/practitioner/practitioner-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"

export default async function EditPractitionerPage() {
  const profile = await getPractitionerProfile()

  if (!profile) {
    return (
      <AppShell>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Edit profile
        </h1>
        <p className="text-muted-foreground">Practitioner profile not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/practitioner">← Back to profile</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit profile</h1>
      </div>

      <PractitionerForm profile={profile} />
    </AppShell>
  )
}
