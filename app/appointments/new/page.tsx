import Link from "next/link"

import { createAppointment } from "@/app/appointments/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string }>
}) {
  await requirePractitionerContext()
  const { date, time } = await searchParams
  const clients = await getActiveClients()
  const prefilledTime =
    time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/appointments"
          label="← Back to appointments"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add appointment
        </h1>
      </div>

      <AppointmentForm
        action={createAppointment}
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
        cancelHref="/appointments"
      />
    </AppShell>
  )
}
