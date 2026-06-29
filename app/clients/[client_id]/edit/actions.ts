"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auditEvents, clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type UpdateClientFormState = {
  error?: string
}

export async function updateClient(
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
  const commsOptOut = formData.get("comms_opt_out") === "on"
  const reminderOptOut = formData.get("reminder_opt_out") === "on"
  const preSessionOptOut = formData.get("pre_session_opt_out") === "on"
  const postSessionOptOut = formData.get("post_session_opt_out") === "on"
  const adminCommsOptOut = formData.get("admin_comms_opt_out") === "on"
  const onlineBookingPermitted = formData.get("online_booking_permitted") === "on"
  const address = String(formData.get("address") ?? "").trim() || null

  if (!firstName || !lastName) {
    return { error: "First name and last name are required." }
  }

  const [existing] = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

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
      dateOfBirth,
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

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/edit`)
  revalidatePath("/clients")

  redirect(`/clients/${clientId}`)
}
