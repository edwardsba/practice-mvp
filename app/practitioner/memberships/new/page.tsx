import { getPracticesForMembershipSelect } from "@/lib/actions/practitioner-practice"
import { MembershipForm } from "@/components/practitioner/membership-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewMembershipPage() {
  await requirePractitionerContext()
  const practices = await getPracticesForMembershipSelect()

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practitioner" label="← Back to profile" />
        <h1 className="text-2xl font-semibold tracking-tight">Add practice</h1>
      </div>

      <MembershipForm practices={practices} />
    </AppShell>
  )
}
