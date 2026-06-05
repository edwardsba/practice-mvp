"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { appointments, auditEvents, clients } from "@/db/schema"
import { parseAppointmentFormData } from "@/lib/appointments/parse-form"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type AppointmentFormState = {
  error?: string
}

async function verifyClientInPractice(clientId: string, practiceId: string) {
  const [client] = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  return client ?? null
}

export async function createAppointment(
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const context = await requirePractitionerContext()
  const parsed = parseAppointmentFormData(formData)

  if ("error" in parsed) {
    return { error: parsed.error }
  }

  const client = await verifyClientInPractice(
    parsed.clientId,
    context.practiceId
  )
  if (!client) {
    return { error: "Client not found." }
  }

  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      const [appointment] = await tx
        .insert(appointments)
        .values({
          clientId: parsed.clientId,
          practiceId: context.practiceId,
          practitionerProfileId: context.practitionerProfileId,
          appointmentDate: parsed.appointmentDate,
          appointmentTime: parsed.appointmentTime,
          durationMinutes: parsed.durationMinutes,
          location: parsed.location,
          status: parsed.status,
          notes: parsed.notes,
          updatedAt: now,
        })
        .returning({ appointmentId: appointments.appointmentId })

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId: parsed.clientId,
        eventType: "appointment.created",
        entityType: "appointment",
        entityId: appointment.appointmentId,
      })
    })
  } catch {
    return { error: "Unable to save appointment. Please try again." }
  }

  revalidatePath("/appointments")
  revalidatePath(`/clients/${parsed.clientId}`)
  redirect("/appointments")
}

export async function updateAppointment(
  appointmentId: string,
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const context = await requirePractitionerContext()
  const existing = await loadAppointmentForPractice(
    appointmentId,
    context.practiceId
  )

  if (!existing) {
    return { error: "Appointment not found." }
  }

  const parsed = parseAppointmentFormData(formData)

  if ("error" in parsed) {
    return { error: parsed.error }
  }

  const client = await verifyClientInPractice(
    parsed.clientId,
    context.practiceId
  )
  if (!client) {
    return { error: "Client not found." }
  }

  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(appointments)
        .set({
          clientId: parsed.clientId,
          appointmentDate: parsed.appointmentDate,
          appointmentTime: parsed.appointmentTime,
          durationMinutes: parsed.durationMinutes,
          location: parsed.location,
          status: parsed.status,
          notes: parsed.notes,
          updatedAt: now,
        })
        .where(
          and(
            eq(appointments.appointmentId, appointmentId),
            eq(appointments.practiceId, context.practiceId)
          )
        )

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId: parsed.clientId,
        eventType: "appointment.updated",
        entityType: "appointment",
        entityId: appointmentId,
      })
    })
  } catch {
    return { error: "Unable to save appointment. Please try again." }
  }

  revalidatePath("/appointments")
  revalidatePath(`/appointments/${appointmentId}`)
  revalidatePath(`/clients/${parsed.clientId}`)
  if (parsed.clientId !== existing.clientId) {
    revalidatePath(`/clients/${existing.clientId}`)
  }
  redirect("/appointments")
}
