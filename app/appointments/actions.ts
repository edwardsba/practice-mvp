"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { appointments, auditEvents, clients } from "@/db/schema"
import { parseAppointmentFormData } from "@/lib/appointments/parse-form"
import type { AppointmentAutomationSummary } from "@/lib/appointments/run-automations"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type AppointmentFormState = {
  error?: string
}

export type TestAutomationsState = {
  error?: string
  result?: AppointmentAutomationSummary
}

export async function testAppointmentAutomations(): Promise<TestAutomationsState> {
  if (process.env.NODE_ENV !== "development") {
    return { error: "Test automations are only available in development." }
  }

  const cronSecret = process.env.CRON_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")

  if (!cronSecret || !appUrl) {
    return { error: "CRON_SECRET or NEXT_PUBLIC_APP_URL is not configured." }
  }

  try {
    const response = await fetch(`${appUrl}/api/cron/appointment-automations`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
    })

    const contentType = response.headers.get("content-type") ?? ""

    if (!contentType.includes("application/json")) {
      const text = await response.text()
      const preview = text.slice(0, 120).replace(/\s+/g, " ")
      return {
        error: `Expected JSON but received ${contentType || "unknown content"} (${response.status}). ${preview}`,
      }
    }

    const payload = (await response.json()) as AppointmentAutomationSummary & {
      error?: string
    }

    if (!response.ok) {
      return {
        error:
          payload.error ??
          `Automation request failed with status ${response.status}.`,
      }
    }

    const result: AppointmentAutomationSummary = {
      reminders_sent: payload.reminders_sent ?? 0,
      batteries_sent: payload.batteries_sent ?? 0,
      errors: payload.errors ?? [],
    }
    revalidatePath("/appointments")
    revalidatePath("/appointments", "page")
    return { result }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to run appointment automations.",
    }
  }
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
  returnTo: string | undefined,
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
  redirect(
    returnTo
      ? `/appointments/${appointmentId}?returnTo=${returnTo}`
      : `/appointments/${appointmentId}`
  )
}
