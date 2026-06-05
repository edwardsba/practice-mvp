"use server"

import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auditEvents, clientEmergencyContacts } from "@/db/schema"
import { verifyClientInPractice } from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type EmergencyContactFormState = {
  error?: string
  success?: boolean
}

function parseContactForm(formData: FormData) {
  const role = String(formData.get("role") ?? "").trim() || null
  const name = String(formData.get("name") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim() || null
  const email = String(formData.get("email") ?? "").trim() || null

  if (!name) {
    throw new Error("Name is required.")
  }

  return { role, name, phone, email }
}

export async function createEmergencyContact(
  clientId: string,
  _prevState: EmergencyContactFormState,
  formData: FormData
): Promise<EmergencyContactFormState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  let values
  try {
    values = parseContactForm(formData)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid contact details.",
    }
  }

  const now = new Date()

  try {
    const [maxOrder] = await db
      .select({
        max: sql<number>`coalesce(max(${clientEmergencyContacts.displayOrder}), -1)`,
      })
      .from(clientEmergencyContacts)
      .where(
        and(
          eq(clientEmergencyContacts.clientId, clientId),
          eq(clientEmergencyContacts.practiceId, context.practiceId)
        )
      )

    const [created] = await db
      .insert(clientEmergencyContacts)
      .values({
        clientId,
        practiceId: context.practiceId,
        ...values,
        displayOrder: (maxOrder?.max ?? -1) + 1,
        updatedAt: now,
      })
      .returning({ contactId: clientEmergencyContacts.contactId })

    await db.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "emergency_contact.created",
      entityType: "client_emergency_contact",
      entityId: created.contactId,
    })
  } catch {
    return { error: "Unable to save emergency contact." }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updateEmergencyContact(
  clientId: string,
  contactId: string,
  _prevState: EmergencyContactFormState,
  formData: FormData
): Promise<EmergencyContactFormState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  let values
  try {
    values = parseContactForm(formData)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid contact details.",
    }
  }

  const now = new Date()

  const [updated] = await db
    .update(clientEmergencyContacts)
    .set({ ...values, updatedAt: now })
    .where(
      and(
        eq(clientEmergencyContacts.contactId, contactId),
        eq(clientEmergencyContacts.clientId, clientId),
        eq(clientEmergencyContacts.practiceId, context.practiceId)
      )
    )
    .returning({ contactId: clientEmergencyContacts.contactId })

  if (!updated) {
    return { error: "Emergency contact not found." }
  }

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "emergency_contact.updated",
    entityType: "client_emergency_contact",
    entityId: updated.contactId,
  })

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function deleteEmergencyContact(
  clientId: string,
  contactId: string
): Promise<EmergencyContactFormState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  const [deleted] = await db
    .delete(clientEmergencyContacts)
    .where(
      and(
        eq(clientEmergencyContacts.contactId, contactId),
        eq(clientEmergencyContacts.clientId, clientId),
        eq(clientEmergencyContacts.practiceId, context.practiceId)
      )
    )
    .returning({ contactId: clientEmergencyContacts.contactId })

  if (!deleted) {
    return { error: "Emergency contact not found." }
  }

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "emergency_contact.deleted",
    entityType: "client_emergency_contact",
    entityId: deleted.contactId,
  })

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
