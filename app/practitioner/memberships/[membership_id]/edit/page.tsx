import { notFound } from "next/navigation"

import { getMembership } from "@/lib/actions/practitioner-practice"
import { MembershipForm } from "@/components/practitioner/membership-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditMembershipPage({
  params,
}: {
  params: Promise<{ membership_id: string }>
}) {
  await requirePractitionerContext()
  const { membership_id: membershipId } = await params
  const membership = await getMembership(membershipId)

  if (!membership) {
    notFound()
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practitioner" label="← Back to profile" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit practice membership
        </h1>
      </div>

      <MembershipForm
        practices={[]}
        initialValues={{
          membershipId: membership.membershipId,
          practiceId: membership.practiceId,
          practiceName: membership.practiceName,
          role: membership.role,
          medicareProviderNumber: membership.medicareProviderNumber,
          availabilityBlocks: membership.availabilityBlocks.map((block) => ({
            dayOfWeek: block.dayOfWeek,
            startTime: block.startTime,
            endTime: block.endTime,
            mode: block.mode as "face_to_face" | "online" | "both",
          })),
        }}
      />
    </AppShell>
  )
}
