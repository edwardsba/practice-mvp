import Link from "next/link"

import { getPractitionerProfile } from "@/app/practitioner/actions"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || "—"
}

export default async function PractitionerPage() {
  const profile = await getPractitionerProfile()

  if (!profile) {
    return (
      <AppShell>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Practitioner profile not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Profile</h1>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Practitioner details</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/practitioner/edit">Edit</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Title</dt>
              <dd className="font-medium">{displayValue(profile.title)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Full name</dt>
              <dd className="font-medium">{displayValue(profile.fullName)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Registration number</dt>
              <dd className="font-medium">
                {displayValue(profile.registrationNumber)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Registration body</dt>
              <dd className="font-medium">
                {displayValue(profile.registrationBody)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </AppShell>
  )
}
