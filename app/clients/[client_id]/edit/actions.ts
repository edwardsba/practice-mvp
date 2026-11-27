"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auditEvents, clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import {
  buildEditDetailsHref,
  type EditDetailsPanelId,
} from "@/lib/clients/edit-details-panels"
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
  revalidatePath(`/clients/${clientId}/background/interview`)
  revalidatePath("/clients")
}

/** Contact details, communication preferences, and optional notes in one update. */
export async function updateClientContactDetails(
  clientId: string,
  mode: "page" | "embedded",
  redirectPanel: EditDetailsPanelId | null,
  includeNotes: boolean,
  _prevState: UpdateClientFormState,
  formData: FormData
): Promise<UpdateClientFormState> {
  const context = await requirePractitionerContext()

  const firstName = String(formData.get("first_name") ?? "").trim()
  const lastName = String(formData.get("last_name") ?? "").trim()
  const preferredName =
    String(formData.get("preferred_name") ?? "").trim() || null
  const email = String(formData.get("email") ?? "").trim() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null
  const address = String(formData.get("address") ?? "").trim() || null

  const commsOptOut = formData.get("comms_opt_out") === "on"
  const reminderOptOut = formData.get("reminder_opt_out") === "on"
  const preSessionOptOut = formData.get("pre_session_opt_out") === "on"
  const postSessionOptOut = formData.get("post_session_opt_out") === "on"
  const adminCommsOptOut = formData.get("admin_comms_opt_out") === "on"
  const onlineBookingPermitted =
    formData.get("online_booking_permitted") === "on"

  if (!firstName || !lastName) {
    return { error: "First name and last name are required." }
  }

  const existing = await requireActiveClient(clientId, context.practiceId)
  if (!existing) {
    return { error: "Client not found." }
  }

  const now = new Date()

  const notes = includeNotes
    ? String(formData.get("notes") ?? "").trim() || null
    : undefined

  await db
    .update(clients)
    .set({
      firstName,
      lastName,
      preferredName,
      email,
      phone,
      address,
      dateOfBirth,
      commsOptOut,
      reminderOptOut,
      preSessionOptOut,
      postSessionOptOut,
      adminCommsOptOut,
      onlineBookingPermitted,
      updatedAt: now,
      ...(notes !== undefined ? { notes } : {}),
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

  if (mode === "embedded") {
    return { success: true }
  }

  const panel = redirectPanel ?? "details"
  redirect(buildEditDetailsHref(clientId, panel, { saved: true }))
}