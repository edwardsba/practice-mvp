import { and, eq, inArray } from "drizzle-orm"

import { auditEvents, clientEmergencyContacts } from "@/db/schema"
import type { EmergencyContactInput } from "@/lib/crisis-plans/types"
import { db } from "@/lib/db"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function syncEmergencyContacts(
  tx: DbTransaction,
  {
    clientId,
    practiceId,
    userId,
    contacts,
  }: {
    clientId: string
    practiceId: string
    userId: string
    contacts: EmergencyContactInput[]
  }
) {
  const now = new Date()
  const keptIds = contacts
    .map((contact) => contact.contactId)
    .filter((id): id is string => Boolean(id))

  const existing = await tx
    .select({ contactId: clientEmergencyContacts.contactId })
    .from(clientEmergencyContacts)
    .where(
      and(
        eq(clientEmergencyContacts.clientId, clientId),
        eq(clientEmergencyContacts.practiceId, practiceId)
      )
    )

  const existingIds = existing.map((row) => row.contactId)
  const removeIds = existingIds.filter((id) => !keptIds.includes(id))

  if (removeIds.length > 0) {
    await tx
      .delete(clientEmergencyContacts)
      .where(
        and(
          eq(clientEmergencyContacts.clientId, clientId),
          eq(clientEmergencyContacts.practiceId, practiceId),
          inArray(clientEmergencyContacts.contactId, removeIds)
        )
      )

    for (const contactId of removeIds) {
      await tx.insert(auditEvents).values({
        practiceId,
        userId,
        clientId,
        eventType: "emergency_contact.deleted",
        entityType: "client_emergency_contact",
        entityId: contactId,
      })
    }
  }

  for (let index = 0; index < contacts.length; index++) {
    const contact = contacts[index]
    const values = {
      role: contact.role || null,
      name: contact.name,
      phone: contact.phone || null,
      email: contact.email || null,
      displayOrder: index,
      updatedAt: now,
    }

    if (contact.contactId) {
      const [updated] = await tx
        .update(clientEmergencyContacts)
        .set(values)
        .where(
          and(
            eq(clientEmergencyContacts.contactId, contact.contactId),
            eq(clientEmergencyContacts.clientId, clientId),
            eq(clientEmergencyContacts.practiceId, practiceId)
          )
        )
        .returning({ contactId: clientEmergencyContacts.contactId })

      if (updated) {
        await tx.insert(auditEvents).values({
          practiceId,
          userId,
          clientId,
          eventType: "emergency_contact.updated",
          entityType: "client_emergency_contact",
          entityId: updated.contactId,
        })
      }
      continue
    }

    const [created] = await tx
      .insert(clientEmergencyContacts)
      .values({
        clientId,
        practiceId,
        ...values,
      })
      .returning({ contactId: clientEmergencyContacts.contactId })

    await tx.insert(auditEvents).values({
      practiceId,
      userId,
      clientId,
      eventType: "emergency_contact.created",
      entityType: "client_emergency_contact",
      entityId: created.contactId,
    })
  }

}
