import Link from "next/link"

import { createAppointment } from "@/app/appointments/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewAppointmentPage() {
  await requirePractitionerContext()
  const clients = await getActiveClients()

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/appointments">← Back to appointments</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Add appointment
        </h1>
      </div>

      <AppointmentForm
        action={createAppointment}
        clients={clients}
        submitLabel="Save appointment"
        cancelHref="/appointments"
      />
    </AppShell>
  )
}
