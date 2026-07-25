import { createAppointment } from "@/app/appointments/actions"
import { getPractitionerProfile } from "@/app/practitioner/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { getMemberships } from "@/lib/actions/practitioner-practice"
import { requirePractitionerContext } from "@/lib/auth"
import { resolveBackNavigation } from "@/lib/navigation/back"

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string
    time?: string
    returnTo?: string
    clientId?: string
  }>
}) {
  const context = await requirePractitionerContext()
  const { date, time, returnTo, clientId } = await searchParams
  const back = resolveBackNavigation(
    returnTo,
    "/appointments",
    "← Back to appointments"
  )
  const [clients, memberships, profile] = await Promise.all([
    getActiveClients(),
    getMemberships(context.practitionerProfileId),
    getPractitionerProfile(),
  ])
  const timeIntervalMinutes = profile?.calendarIntervalMinutes ?? 30
  const prefilledTime =
    time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time

  const availabilityBlocks = memberships.flatMap((membership) =>
    membership.availabilityBlocks.map((block) => ({
      dayOfWeek: block.dayOfWeek,
      startTime: block.startTime,
      endTime: block.endTime,
      mode: block.mode,
    }))
  )

  const practiceMemberships = memberships.map((membership) => ({
    membershipId: membership.membershipId,
    practiceName: membership.practiceName,
  }))

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref={back.href} label={back.label} />
      </div>
      <ListPageHeader heading="Add appointment" />

      <AppointmentForm
        action={createAppointment.bind(null, returnTo)}
        clients={clients}
        practiceId={context.practiceId}
        availabilityBlocks={availabilityBlocks}
        practiceMemberships={practiceMemberships}
        timeIntervalMinutes={timeIntervalMinutes}
        initialValues={
          date && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? {
                clientId: clientId ?? "",
                appointmentDate: date,
                appointmentTime: prefilledTime ?? "",
                durationMinutes: 50,
                notes: null,
              }
            : clientId
              ? {
                  clientId,
                  appointmentDate: "",
                  appointmentTime: "",
                  durationMinutes: 50,
                  notes: null,
                }
              : undefined
        }
        submitLabel="Save appointment"
        cancelHref={back.href}
      />
    </AppShell>
  )
}
