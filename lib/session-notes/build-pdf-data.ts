import type { loadSessionNoteForPractice } from "@/lib/session-notes/load"
import type { loadSessionNoteViewContext } from "@/lib/session-notes/load-context"
import { formatClientNameLastFirst } from "@/lib/appointments/format"
import type { SessionNotePdfData } from "@/lib/session-notes/generate-pdf"

export async function buildSessionNotePdfData(
  note: NonNullable<Awaited<ReturnType<typeof loadSessionNoteForPractice>>>,
  viewContext: Awaited<ReturnType<typeof loadSessionNoteViewContext>>
): Promise<SessionNotePdfData> {
  return {
    clientId: note.clientId,
    clientName: formatClientNameLastFirst(
      note.clientFirstName,
      note.clientLastName
    ),
    dateOfBirth: note.clientDateOfBirth,
    sessionDate: note.sessionDate,
    sessionTime: note.sessionTime,
    therapeuticTarget: viewContext.treatmentPlan?.therapeuticTarget ?? null,
    btpTargets: viewContext.btpTargets,
    assessments: viewContext.assessments,
    assistResult: viewContext.assistResult,
    mseSentence: viewContext.mseInstance?.sentence ?? null,
    asqResult: viewContext.asqResult,
    crisisPlan: viewContext.crisisPlan,
    practitionerNotes: note.practitionerNotes,
    nextAppointment: viewContext.nextAppointment,
    practitionerName: viewContext.practitionerName,
    practitionerTitle: viewContext.practitionerTitle,
    practitionerDisplayName: viewContext.practitionerDisplayName,
  }
}
