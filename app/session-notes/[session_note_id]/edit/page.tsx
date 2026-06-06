import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { updateSessionNote } from "@/app/session-notes/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { SessionNoteForm } from "@/components/session-notes/session-note-form"
import { requirePractitionerContext } from "@/lib/auth"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

export default async function EditSessionNotePage({
  params,
}: {
  params: Promise<{ session_note_id: string }>
}) {
  const { session_note_id: sessionNoteId } = await params
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(
    sessionNoteId,
    context.practiceId
  )

  if (!note) {
    notFound()
  }

  if (note.status === "finalised") {
    redirect(`/session-notes/${sessionNoteId}`)
  }

  const clients = await getActiveClients()
  const boundUpdate = updateSessionNote.bind(null, sessionNoteId)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/session-notes/${sessionNoteId}`}
          label="← Back to session note"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit Session Note
        </h1>
      </div>

      <SessionNoteForm
        action={boundUpdate}
        clients={clients}
        initialValues={{
          clientId: note.clientId,
          sessionDate: note.sessionDate,
          sessionTime: note.sessionTime,
          practitionerNotes: note.practitionerNotes,
          appointmentId: note.appointmentId,
        }}
        submitLabel="Save Changes"
        cancelHref={`/session-notes/${sessionNoteId}`}
        lockClient
      />
    </AppShell>
  )
}
