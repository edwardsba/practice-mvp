import Link from "next/link"

import { createSessionNote } from "@/app/session-notes/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { SessionNoteForm } from "@/components/session-notes/session-note-form"
import { todayDateString } from "@/lib/appointments/format"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewSessionNotePage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; appointment_id?: string }>
}) {
  const { client_id: clientIdParam, appointment_id: appointmentIdParam } =
    await searchParams
  const context = await requirePractitionerContext()
  const clients = await getActiveClients()

  const appointmentId = appointmentIdParam?.trim() || ""
  const appointment = appointmentId
    ? await loadAppointmentForPractice(appointmentId, context.practiceId)
    : null

  const clientId = appointment?.clientId ?? clientIdParam?.trim() ?? ""
  const sessionDate = appointment?.appointmentDate ?? todayDateString()
  const sessionTime = appointment?.appointmentTime ?? null

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/session-notes">← Back to session notes</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          New Session Note
        </h1>
      </div>

      <SessionNoteForm
        action={createSessionNote}
        clients={clients}
        initialValues={{
          clientId,
          sessionDate,
          sessionTime,
          practitionerNotes: null,
          appointmentId: appointmentId || null,
        }}
        submitLabel="Save Session Note"
        cancelHref="/session-notes"
        lockClient={Boolean(clientId)}
      />
    </AppShell>
  )
}
