"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auditEvents, sessionNotes } from "@/db/schema"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { findBatteryInstanceForAppointment } from "@/lib/session-notes/battery-link"
import {
  loadSessionNoteForPractice,
} from "@/lib/session-notes/load"
import { parseSessionNoteFormData } from "@/lib/session-notes/parse-form"
import { verifyClientInPractice } from "@/lib/treatment-plans/load"

export type SessionNoteFormState = {
  error?: string
}

export type FinaliseSessionNoteState = {
  error?: string
  success?: boolean
}

export async function createSessionNote(
  _prevState: SessionNoteFormState,
  formData: FormData
): Promise<SessionNoteFormState> {
  const context = await requirePractitionerContext()
  const values = parseSessionNoteFormData(formData)

  if (!values.clientId || !values.sessionDate) {
    return { error: "Client and session date are required." }
  }

  const client = await verifyClientInPractice(values.clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  let appointmentId: string | null = values.appointmentId
  let batteryInstanceId: string | null = null

  if (appointmentId) {
    const appointment = await loadAppointmentForPractice(
      appointmentId,
      context.practiceId
    )
    if (!appointment || appointment.clientId !== values.clientId) {
      return { error: "Appointment not found for this client." }
    }

    batteryInstanceId = await findBatteryInstanceForAppointment(
      values.clientId,
      context.practiceId,
      appointment.preSessionBatterySentAt
    )
  }

  let sessionNoteId: string

  try {
    await db.transaction(async (tx) => {
      const [note] = await tx
        .insert(sessionNotes)
        .values({
          clientId: values.clientId,
          practiceId: context.practiceId,
          practitionerProfileId: context.practitionerProfileId,
          appointmentId,
          batteryInstanceId,
          sessionDate: values.sessionDate,
          sessionTime: values.sessionTime,
          practitionerNotes: values.practitionerNotes,
          status: "draft",
        })
        .returning({ sessionNoteId: sessionNotes.sessionNoteId })

      sessionNoteId = note.sessionNoteId

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId: values.clientId,
        eventType: "session_note.created",
        entityType: "session_note",
        entityId: note.sessionNoteId,
      })
    })
  } catch {
    return { error: "Unable to create session note. Please try again." }
  }

  revalidatePath("/session-notes")
  revalidatePath(`/clients/${values.clientId}`)
  redirect(`/session-notes/${sessionNoteId!}`)
}

export async function updateSessionNote(
  sessionNoteId: string,
  _prevState: SessionNoteFormState,
  formData: FormData
): Promise<SessionNoteFormState> {
  const context = await requirePractitionerContext()
  const values = parseSessionNoteFormData(formData)

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
  if (!note) {
    return { error: "Session note not found." }
  }

  if (note.status === "finalised") {
    redirect(`/session-notes/${sessionNoteId}`)
  }

  if (!values.sessionDate) {
    return { error: "Session date is required." }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sessionNotes)
        .set({
          sessionDate: values.sessionDate,
          sessionTime: values.sessionTime,
          practitionerNotes: values.practitionerNotes,
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
    return { error: "Unable to update session note. Please try again." }
  }

  revalidatePath("/session-notes")
  revalidatePath(`/session-notes/${sessionNoteId}`)
  revalidatePath(`/clients/${note.clientId}`)
  redirect(`/session-notes/${sessionNoteId}`)
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

  revalidatePath("/session-notes")
  revalidatePath(`/session-notes/${sessionNoteId}`)
  revalidatePath(`/clients/${note.clientId}`)
  return { success: true }
}
