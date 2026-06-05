import Link from "next/link"
import { notFound } from "next/navigation"

import { updateAppointment } from "@/app/appointments/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ appointment_id: string }>
}) {
  const { appointment_id: appointmentId } = await params
  const context = await requirePractitionerContext()

  const [appointment, clients] = await Promise.all([
    loadAppointmentForPractice(appointmentId, context.practiceId),
    getActiveClients(),
  ])

  if (!appointment) {
    notFound()
  }

  const clientName = `${appointment.clientFirstName} ${appointment.clientLastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/appointments">← Back to appointments</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit appointment
        </h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <AppointmentForm
        action={updateAppointment.bind(null, appointmentId)}
        clients={clients}
        initialValues={{
          clientId: appointment.clientId,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          durationMinutes: appointment.durationMinutes,
          location: appointment.location,
          status: appointment.status,
          notes: appointment.notes,
        }}
        submitLabel="Save appointment"
        cancelHref="/appointments"
      />
    </AppShell>
  )
}
