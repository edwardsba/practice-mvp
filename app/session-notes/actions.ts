"use server"

import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { appointments, auditEvents, clients, sessionNotes } from "@/db/schema"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import {
  formatClientNameLastFirst,
  todayDateString,
} from "@/lib/appointments/format"
import {
  sendPreSessionBatteryForAppointment,
  type SendPreSessionBatteryResult,
} from "@/lib/appointments/run-automations"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  loadSessionNoteForPractice,
} from "@/lib/session-notes/load"
import { generateSessionNotePdf } from "@/lib/session-notes/generate-pdf"
import { loadSessionNoteViewContext } from "@/lib/session-notes/load-context"
import { uploadSessionNotePdf } from "@/lib/session-notes/upload-pdf"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyClientInPractice } from "@/lib/treatment-plans/load"

async function buildPdfData(
  note: NonNullable<Awaited<ReturnType<typeof loadSessionNoteForPractice>>>,
  viewContext: Awaited<ReturnType<typeof loadSessionNoteViewContext>>
) {
  return {
    clientId: note.clientId,
    clientName: formatClientNameLastFirst(
      note.clientFirstName,
      note.clientLastName
    ),
    dateOfBirth: note.clientDateOfBirth,
    sessionDate: note.sessionDate,
    sessionTime: note.sessionTime,
    therapeuticTarget: viewContext.therapeuticTarget,
    btpTargets: viewContext.btpTargets,
    assessments: viewContext.assessments,
    asqResult: viewContext.asqResult,
    crisisPlan: viewContext.crisisPlan,
    practitionerNotes: note.practitionerNotes,
    nextAppointment: viewContext.nextAppointment,
    practitionerName: viewContext.practitionerName,
    practitionerTitle: viewContext.practitionerTitle,
    practitionerDisplayName: viewContext.practitionerDisplayName,
  }
}

export type FinaliseSessionNoteState = {
  error?: string
  success?: boolean
}

export async function createDraftSessionNote(
  clientId: string,
  appointmentId: string | null
) {
  const context = await requirePractitionerContext()

  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    throw new Error("Client not found.")
  }

  let sessionDate = todayDateString()
  let sessionTime: string | null = null

  if (appointmentId) {
    const appointment = await loadAppointmentForPractice(
      appointmentId,
      context.practiceId
    )
    if (!appointment || appointment.clientId !== clientId) {
      throw new Error("Appointment not found for this client.")
    }
    sessionDate = appointment.appointmentDate
    sessionTime = appointment.appointmentTime
  }

  let sessionNoteId: string

  await db.transaction(async (tx) => {
    const [note] = await tx
      .insert(sessionNotes)
      .values({
        clientId,
        practiceId: context.practiceId,
        practitionerProfileId: context.practitionerProfileId,
        appointmentId,
        sessionDate,
        sessionTime,
        practitionerNotes: null,
        status: "draft",
      })
      .returning({ sessionNoteId: sessionNotes.sessionNoteId })

    sessionNoteId = note.sessionNoteId

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "session_note.created",
      entityType: "session_note",
      entityId: note.sessionNoteId,
    })
  })

  revalidatePath("/session-notes")
  revalidatePath(`/clients/${clientId}`)
  redirect(`/session-notes/${sessionNoteId!}`)
}

export type UpdateSessionNoteNotesState = {
  error?: string
}

export async function updateSessionNoteNotes(
  sessionNoteId: string,
  notes: string
): Promise<UpdateSessionNoteNotesState> {
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
  if (!note) {
    return { error: "Session note not found." }
  }
  if (note.status === "finalised") {
    return { error: "This session note has been finalised." }
  }

  try {
    await db
      .update(sessionNotes)
      .set({
        practitionerNotes: notes.trim() || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionNotes.sessionNoteId, sessionNoteId),
          eq(sessionNotes.practiceId, context.practiceId)
        )
      )
  } catch {
    return { error: "Unable to save notes." }
  }

  return {}
}

export type UpdateSessionNoteDateTimeState = {
  error?: string
}

export async function updateSessionNoteDateTime(
  sessionNoteId: string,
  sessionDate: string,
  sessionTime: string | null
): Promise<UpdateSessionNoteDateTimeState> {
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
  if (!note) {
    return { error: "Session note not found." }
  }
  if (note.status === "finalised") {
    return { error: "This session note has been finalised." }
  }
  if (!sessionDate) {
    return { error: "Session date is required." }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sessionNotes)
        .set({
          sessionDate,
          sessionTime,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sessionNotes.sessionNoteId, sessionNoteId),
            eq(sessionNotes.practiceId, context.practiceId)
          )
        )

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId: note.clientId,
        eventType: "session_note.updated",
        entityType: "session_note",
        entityId: sessionNoteId,
      })
    })
  } catch {
    return { error: "Unable to update session date and time." }
  }

  revalidatePath(`/session-notes/${sessionNoteId}`)
  return {}
}

export type GenerateSessionNotePdfPreviewState = {
  error?: string
  pdfBase64?: string
}

export async function generateSessionNotePdfPreview(
  sessionNoteId: string,
  _prevState: GenerateSessionNotePdfPreviewState
): Promise<GenerateSessionNotePdfPreviewState> {
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
  if (!note) {
    return { error: "Session note not found." }
  }

  const viewContext = await loadSessionNoteViewContext(note)
  const pdfData = await buildPdfData(note, viewContext)
  const buffer = await generateSessionNotePdf(pdfData)

  return { pdfBase64: buffer.toString("base64") }
}

export async function finaliseSessionNote(
  sessionNoteId: string,
  _prevState: FinaliseSessionNoteState
): Promise<FinaliseSessionNoteState> {
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
  if (!note) {
    return { error: "Session note not found." }
  }

  if (note.status === "finalised") {
    return { success: true }
  }

  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sessionNotes)
        .set({
          status: "finalised",
          finalisedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(sessionNotes.sessionNoteId, sessionNoteId),
            eq(sessionNotes.practiceId, context.practiceId)
          )
        )

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId: note.clientId,
        eventType: "session_note.finalised",
        entityType: "session_note",
        entityId: sessionNoteId,
      })
    })
  } catch {
    return { error: "Unable to finalise session note. Please try again." }
  }

  const viewContext = await loadSessionNoteViewContext(note)
  const pdfData = await buildPdfData(note, viewContext)
  const uploadResult = await uploadSessionNotePdf(
    sessionNoteId,
    context.practiceId,
    pdfData
  )

  if (!uploadResult.ok) {
    console.error("PDF upload failed after finalise:", uploadResult.error)
  }

  revalidatePath("/session-notes")
  revalidatePath(`/session-notes/${sessionNoteId}`)
  revalidatePath(`/clients/${note.clientId}`)
  return { success: true }
}

export type GetSessionNotePdfDownloadUrlState = {
  error?: string
  url?: string
}

export async function getSessionNotePdfDownloadUrl(
  sessionNoteId: string
): Promise<GetSessionNotePdfDownloadUrlState> {
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
  if (!note || !note.pdfStoragePath) {
    return { error: "No PDF available for this session note." }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from("session-note-pdfs")
    .createSignedUrl(note.pdfStoragePath, 60)

  if (error || !data?.signedUrl) {
    return { error: "Unable to generate download link." }
  }

  return { url: data.signedUrl }
}

export type ExportSessionNotesState = {
  error?: string
  links?: { sessionNoteId: string; sessionDate: string; url: string }[]
}

export async function exportSessionNotePdfs(
  clientId: string,
  _prevState: ExportSessionNotesState
): Promise<ExportSessionNotesState> {
  const context = await requirePractitionerContext()

  const notes = await db
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      sessionDate: sessionNotes.sessionDate,
      pdfStoragePath: sessionNotes.pdfStoragePath,
    })
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.clientId, clientId),
        eq(sessionNotes.practiceId, context.practiceId),
        eq(sessionNotes.status, "finalised")
      )
    )
    .orderBy(asc(sessionNotes.sessionDate))

  const notesWithPdfs = notes.filter((n) => n.pdfStoragePath)

  if (notesWithPdfs.length === 0) {
    return { error: "No finalised session note PDFs found for this client." }
  }

  const supabase = createAdminClient()
  const links: { sessionNoteId: string; sessionDate: string; url: string }[] = []

  for (const note of notesWithPdfs) {
    const { data, error } = await supabase.storage
      .from("session-note-pdfs")
      .createSignedUrl(note.pdfStoragePath!, 300)

    if (!error && data?.signedUrl) {
      links.push({
        sessionNoteId: note.sessionNoteId,
        sessionDate: note.sessionDate,
        url: data.signedUrl,
      })
    }
  }

  if (links.length === 0) {
    return { error: "Unable to generate download links." }
  }

  return { links }
}

export async function resendPreSessionBattery(
  appointmentId: string
): Promise<SendPreSessionBatteryResult> {
  const context = await requirePractitionerContext()

  const [row] = await db
    .select({
      appointmentId: appointments.appointmentId,
      clientId: appointments.clientId,
      practiceId: appointments.practiceId,
      practitionerProfileId: appointments.practitionerProfileId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      location: appointments.location,
      mode: appointments.mode,
      clientEmail: clients.email,
      commsOptOut: clients.commsOptOut,
      preSessionOptOut: clients.preSessionOptOut,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .where(
      and(
        eq(appointments.appointmentId, appointmentId),
        eq(appointments.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return { status: "failed", error: "Appointment not found." }
  }

  return sendPreSessionBatteryForAppointment(row, { userId: context.userId })
}
