import Link from "next/link"

import { getPractice } from "@/app/practice/actions"
import { PracticeForm } from "@/app/practice/practice-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"

export default async function EditPracticePage() {
  const practice = await getPractice()

  if (!practice) {
    return (
      <AppShell>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Edit practice
        </h1>
        <p className="text-muted-foreground">Practice record not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practice" label="← Back to practice" />
      </div>
      <EntityPageHeader kicker="Practice edit" name={practice.practiceName} />

      <PracticeForm practice={practice} />
    </AppShell>
  )
}
