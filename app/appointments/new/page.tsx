import { createAppointment } from "@/app/appointments/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { requirePractitionerContext } from "@/lib/auth"
import { resolveBackNavigation } from "@/lib/navigation/back"

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; returnTo?: string }>
}) {
  await requirePractitionerContext()
  const { date, time, returnTo } = await searchParams
  const back = resolveBackNavigation(
    returnTo,
    "/appointments",
    "← Back to appointments"
  )
  const clients = await getActiveClients()
  const prefilledTime =
    time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref={back.href} label={back.label} />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add appointment
        </h1>
      </div>

      <AppointmentForm
        action={createAppointment.bind(null, returnTo)}
        clients={clients}
        initialValues={
          date && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? {
                clientId: "",
                appointmentDate: date,
                appointmentTime: prefilledTime ?? "",
                durationMinutes: 50,
                location: null,
                status: "scheduled",
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
