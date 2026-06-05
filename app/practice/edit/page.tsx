import Link from "next/link"

import { getPractice } from "@/app/practice/actions"
import { PracticeForm } from "@/app/practice/practice-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"

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
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/practice">← Back to practice</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit practice</h1>
      </div>

      <PracticeForm practice={practice} />
    </AppShell>
  )
}
