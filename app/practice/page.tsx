import { AppShell } from "@/components/app-shell"
import { getPractice } from "@/app/practice/actions"
import { PracticeForm } from "@/app/practice/practice-form"

export default async function PracticePage() {
  const practice = await getPractice()

  if (!practice) {
    return (
      <AppShell title="Practice Settings">
        <p className="text-muted-foreground">Practice record not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell title="Practice Settings">
      <PracticeForm practice={practice} />
    </AppShell>
  )
}
