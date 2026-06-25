import Link from "next/link"

import { getPractice } from "@/app/practice/actions"
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

export default async function PracticePage() {
  const practice = await getPractice()

  if (!practice) {
    return (
      <AppShell>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Practice</h1>
        <p className="text-muted-foreground">Practice record not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Practice</h1>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Practice details</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/practice/edit">Edit</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Practice name</dt>
              <dd className="font-medium">{displayValue(practice.practiceName)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Location nickname</dt>
              <dd className="font-medium">{displayValue(practice.locationNickname)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Timezone</dt>
              <dd className="font-medium">{displayValue(practice.timezone)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">ABN</dt>
              <dd className="font-medium">{displayValue(practice.abn)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Phone</dt>
              <dd className="font-medium">{displayValue(practice.phone)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Fax</dt>
              <dd className="font-medium">{displayValue(practice.fax)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="font-medium">{displayValue(practice.email)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Website</dt>
              <dd className="font-medium">{displayValue(practice.website)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Address</dt>
              <dd className="font-medium">{displayValue(practice.address)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </AppShell>
  )
}
