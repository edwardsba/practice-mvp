export type SessionNoteFormValues = {
  clientId: string
  sessionDate: string
  sessionTime: string | null
  practitionerNotes: string | null
  appointmentId: string | null
}

export function parseSessionNoteFormData(formData: FormData): SessionNoteFormValues {
  const clientId = String(formData.get("client_id") ?? "").trim()
  const sessionDate = String(formData.get("session_date") ?? "").trim()
  const sessionTimeRaw = String(formData.get("session_time") ?? "").trim()
  const practitionerNotesRaw = String(formData.get("practitioner_notes") ?? "").trim()
  const appointmentIdRaw = String(formData.get("appointment_id") ?? "").trim()

  return {
    clientId,
    sessionDate,
    sessionTime: sessionTimeRaw || null,
    practitionerNotes: practitionerNotesRaw || null,
    appointmentId: appointmentIdRaw || null,
  }
}
