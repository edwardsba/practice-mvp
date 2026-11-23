"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auditEvents, clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { buildEditDetailsHref } from "@/lib/clients/edit-details-panels"
import { db } from "@/lib/db"

export type UpdateClientFormState = {
  error?: string
  success?: boolean
}

async function requireActiveClient(clientId: string, practiceId: string) {
  const [existing] = await db
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
  return existing ?? null
}

function revalidateClientPaths(clientId: string) {
  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/edit`)
  revalidatePath("/clients")
}

/** Contact information only — leaves communication preference columns untouched. */
export async function updateClientContact(
  clientId: string,
  _prevState: UpdateClientFormState,
  formData: FormData
): Promise<UpdateClientFormState> {
  const context = await requirePractitionerContext()

  const firstName = String(formData.get("first_name") ?? "").trim()
  const lastName = String(formData.get("last_name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null
  const address = String(formData.get("address") ?? "").trim() || null
  const notes = String(formData.get("notes") ?? "").trim() || null

  if (!firstName || !lastName) {
    return { error: "First name and last name are required." }
  }

  const existing = await requireActiveClient(clientId, context.practiceId)
  if (!existing) {
    return { error: "Client not found." }
  }

  const now = new Date()

  await db
    .update(clients)
    .set({
      firstName,
      lastName,
      email,
      phone,
      address,
      notes,
      dateOfBirth,
      updatedAt: now,
    })
    .where(eq(clients.clientId, clientId))

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "client.updated",
    entityType: "client",
    entityId: clientId,
  })

  revalidateClientPaths(clientId)
  redirect(buildEditDetailsHref(clientId, "details", { saved: true }))
}

/** Communication preferences only — leaves contact fields untouched. */
export async function updateClientCommunication(
  clientId: string,
  _prevState: UpdateClientFormState,
  formData: FormData
): Promise<UpdateClientFormState> {
  const context = await requirePractitionerContext()

  const commsOptOut = formData.get("comms_opt_out") === "on"
  const reminderOptOut = formData.get("reminder_opt_out") === "on"
  const preSessionOptOut = formData.get("pre_session_opt_out") === "on"
  const postSessionOptOut = formData.get("post_session_opt_out") === "on"
  const adminCommsOptOut = formData.get("admin_comms_opt_out") === "on"
  const onlineBookingPermitted =
    formData.get("online_booking_permitted") === "on"

  const existing = await requireActiveClient(clientId, context.practiceId)
  if (!existing) {
    return { error: "Client not found." }
  }

  const now = new Date()

  await db
    .update(clients)
    .set({
      commsOptOut,
      reminderOptOut,
      preSessionOptOut,
      postSessionOptOut,
      adminCommsOptOut,
      onlineBookingPermitted,
      updatedAt: now,
    })
    .where(eq(clients.clientId, clientId))

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "client.updated",
    entityType: "client",
    entityId: clientId,
  })

  revalidateClientPaths(clientId)
  redirect(buildEditDetailsHref(clientId, "communication", { saved: true }))
}
