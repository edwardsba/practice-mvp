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
import {
  countNonFinalisedSessionNotesByAppointment,
  logDeleteAuditEvent,
} from "@/lib/delete/delete-utils"
import { APPOINTMENT_STATUS_TRANSITIONS } from "@/lib/status"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function applyAppointmentCancellation(
  tx: DbTransaction,
  appointmentId: string,
  practiceId: string,
  source: "practitioner" | "client"
) {
  await tx
    .update(appointments)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationSource: source,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointments.appointmentId, appointmentId),
        eq(appointments.practiceId, practiceId)
      )
    )
}

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
      post_session_sent: payload.post_session_sent ?? 0,
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
  returnTo: string | undefined,
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
          mode: parsed.mode,
          fundingApprovalId: parsed.fundingApprovalId,
          appointmentTypeId: parsed.appointmentTypeId,
          membershipId: parsed.membershipId,
          status: "scheduled",
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
  revalidatePath("/calendar")
  revalidatePath(`/clients/${parsed.clientId}`)
  redirect(returnTo ?? "/appointments")
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
          mode: parsed.mode,
          fundingApprovalId: parsed.fundingApprovalId,
          appointmentTypeId: parsed.appointmentTypeId,
          membershipId: parsed.membershipId,
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

export async function getAppointmentDeleteStatus(appointmentId: string) {
  const context = await requirePractitionerContext()
  const appointment = await loadAppointmentForPractice(
    appointmentId,
    context.practiceId
  )

  if (!appointment) {
    return { blockedReason: "Appointment not found." }
  }

  const sessionNoteCount = await countNonFinalisedSessionNotesByAppointment(
    appointmentId,
    context.practiceId
  )

  if (sessionNoteCount > 0) {
    return {
      blockedReason: `Cannot delete: appointment has ${sessionNoteCount} non-finalised session notes.`,
    }
  }

  return {}
}

export async function deleteAppointment(
  appointmentId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    return { error: "Unauthorized practice access." }
  }

  const status = await getAppointmentDeleteStatus(appointmentId)
  if (status.blockedReason) {
    return { blockedReason: status.blockedReason }
  }

  const appointment = await loadAppointmentForPractice(
    appointmentId,
    practiceId
  )
  if (!appointment) {
    return { error: "Appointment not found." }
  }

  try {
    await db.transaction(async (tx) => {
      await applyAppointmentCancellation(
        tx,
        appointmentId,
        practiceId,
        "practitioner"
      )
    })

    await logDeleteAuditEvent({
      practiceId,
      userId: context.userId,
      clientId: appointment.clientId,
      eventType: "appointment.deleted",
      entityType: "appointment",
      entityId: appointmentId,
    })
  } catch {
    return { error: "Unable to delete appointment. Please try again." }
  }

  revalidatePath("/appointments")
  revalidatePath(`/appointments/${appointmentId}`)
  revalidatePath(`/clients/${appointment.clientId}`)
  redirect("/appointments")
}

export async function transitionAppointmentStatus(
  appointmentId: string,
  newStatus: string
): Promise<{ error?: string }> {
  const context = await requirePractitionerContext()
  const appointment = await loadAppointmentForPractice(
    appointmentId,
    context.practiceId
  )

  if (!appointment) {
    return { error: "Appointment not found." }
  }

  const allowedTransitions =
    APPOINTMENT_STATUS_TRANSITIONS[appointment.status] ?? []
  if (!allowedTransitions.includes(newStatus)) {
    return { error: "Invalid status transition." }
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    if (newStatus === "cancelled") {
      await applyAppointmentCancellation(
        tx,
        appointmentId,
        context.practiceId,
        "practitioner"
      )
    } else {
      await tx
        .update(appointments)
        .set({
          status: newStatus,
          updatedAt: now,
        })
        .where(
          and(
            eq(appointments.appointmentId, appointmentId),
            eq(appointments.practiceId, context.practiceId)
          )
        )
    }

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId: appointment.clientId,
      eventType: "appointment.status_changed",
      entityType: "appointment",
      entityId: appointmentId,
    })
  })

  revalidatePath(`/appointments/${appointmentId}`)
  revalidatePath("/appointments")
  revalidatePath(`/clients/${appointment.clientId}`)

  return {}
}

/** @deprecated Use transitionAppointmentStatus instead. */
export async function markAppointmentNoShow(
  appointmentId: string
): Promise<void> {
  const context = await requirePractitionerContext()
  const appointment = await loadAppointmentForPractice(
    appointmentId,
    context.practiceId
  )
  if (!appointment) throw new Error("Appointment not found.")
  if (appointment.status === "cancelled") {
    throw new Error("Cannot mark a cancelled appointment as no-show.")
  }
  if (appointment.status === "no_show") {
    throw new Error("Appointment is already marked as no-show.")
  }

  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status: "no_show", updatedAt: new Date() })
      .where(
        and(
          eq(appointments.appointmentId, appointmentId),
          eq(appointments.practiceId, context.practiceId)
        )
      )
    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId: appointment.clientId,
      eventType: "appointment.no_show",
      entityType: "appointment",
      entityId: appointmentId,
    })
  })

  revalidatePath(`/appointments/${appointmentId}`)
  revalidatePath("/appointments")
  revalidatePath(`/clients/${appointment.clientId}`)
  redirect(`/appointments/${appointmentId}`)
}
