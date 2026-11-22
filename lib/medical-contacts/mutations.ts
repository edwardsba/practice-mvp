import "server-only"

import { and, eq } from "drizzle-orm"

import {
  auditEvents,
  clientEventRecords,
  clientMedicalContacts,
  clients,
  professionals,
} from "@/db/schema"
import { toEvent } from "@/lib/client-background/map"
import { db } from "@/lib/db"
import {
  MEDICAL_CONTACT_IN_USE_MESSAGE,
  medicalContactSupervisesHistoryMedication,
} from "@/lib/medical-contacts/rules"

async function assertClient(clientId: string, practiceId: string) {
  const [row] = await db
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
  return row ?? null
}

async function assertProfessional(professionalId: string, practiceId: string) {
  const [row] = await db
    .select({ professionalId: professionals.professionalId })
    .from(professionals)
    .where(
      and(
        eq(professionals.professionalId, professionalId),
        eq(professionals.practiceId, practiceId),
        eq(professionals.isActive, true)
      )
    )
    .limit(1)
  return row ?? null
}

/** Ensure a professional is on the client's medical contacts list; return the row id. */
export async function ensureMedicalContact(input: {
  clientId: string
  practiceId: string
  userId: string
  professionalId: string
  isMain?: boolean
  notes?: string | null
}): Promise<{ medicalContactId: string; created: boolean; error?: string }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { medicalContactId: "", created: false, error: "Client not found." }
  const professional = await assertProfessional(input.professionalId, input.practiceId)
  if (!professional) {
    return { medicalContactId: "", created: false, error: "Professional not found." }
  }

  const [existing] = await db
    .select({
      medicalContactId: clientMedicalContacts.medicalContactId,
    })
    .from(clientMedicalContacts)
    .where(
      and(
        eq(clientMedicalContacts.clientId, input.clientId),
        eq(clientMedicalContacts.practiceId, input.practiceId),
        eq(clientMedicalContacts.professionalId, input.professionalId)
      )
    )
    .limit(1)

  if (existing) {
    if (input.isMain) {
      await setMainMedicalContact({
        clientId: input.clientId,
        practiceId: input.practiceId,
        userId: input.userId,
        medicalContactId: existing.medicalContactId,
      })
    }
    return { medicalContactId: existing.medicalContactId, created: false }
  }

  const now = new Date()
  let medicalContactId = ""

  await db.transaction(async (tx) => {
    if (input.isMain) {
      await tx
        .update(clientMedicalContacts)
        .set({ isMain: false, updatedAt: now })
        .where(
          and(
            eq(clientMedicalContacts.clientId, input.clientId),
            eq(clientMedicalContacts.practiceId, input.practiceId)
          )
        )
    }

    const [created] = await tx
      .insert(clientMedicalContacts)
      .values({
        clientId: input.clientId,
        practiceId: input.practiceId,
        professionalId: input.professionalId,
        isMain: Boolean(input.isMain),
        notes: input.notes?.trim() || null,
        updatedAt: now,
      })
      .returning({ medicalContactId: clientMedicalContacts.medicalContactId })

    medicalContactId = created.medicalContactId

    await tx.insert(auditEvents).values({
      practiceId: input.practiceId,
      userId: input.userId,
      clientId: input.clientId,
      eventType: "client_medical_contact.created",
      entityType: "client_medical_contact",
      entityId: created.medicalContactId,
    })
  })

  return { medicalContactId, created: true }
}

export async function setMainMedicalContact(input: {
  clientId: string
  practiceId: string
  userId: string
  medicalContactId: string
}): Promise<{ error?: string }> {
  const now = new Date()
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ medicalContactId: clientMedicalContacts.medicalContactId })
      .from(clientMedicalContacts)
      .where(
        and(
          eq(clientMedicalContacts.medicalContactId, input.medicalContactId),
          eq(clientMedicalContacts.clientId, input.clientId),
          eq(clientMedicalContacts.practiceId, input.practiceId)
        )
      )
      .limit(1)
    if (!target) return { error: "Medical contact not found." }

    await tx
      .update(clientMedicalContacts)
      .set({ isMain: false, updatedAt: now })
      .where(
        and(
          eq(clientMedicalContacts.clientId, input.clientId),
          eq(clientMedicalContacts.practiceId, input.practiceId)
        )
      )

    await tx
      .update(clientMedicalContacts)
      .set({ isMain: true, updatedAt: now })
      .where(eq(clientMedicalContacts.medicalContactId, input.medicalContactId))

    await tx.insert(auditEvents).values({
      practiceId: input.practiceId,
      userId: input.userId,
      clientId: input.clientId,
      eventType: "client_medical_contact.updated",
      entityType: "client_medical_contact",
      entityId: input.medicalContactId,
    })

    return {}
  })
}

export async function updateMedicalContact(input: {
  clientId: string
  practiceId: string
  userId: string
  medicalContactId: string
  isMain: boolean
  notes: string | null
}): Promise<{ error?: string }> {
  const now = new Date()
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ medicalContactId: clientMedicalContacts.medicalContactId })
      .from(clientMedicalContacts)
      .where(
        and(
          eq(clientMedicalContacts.medicalContactId, input.medicalContactId),
          eq(clientMedicalContacts.clientId, input.clientId),
          eq(clientMedicalContacts.practiceId, input.practiceId)
        )
      )
      .limit(1)
    if (!target) return { error: "Medical contact not found." }

    if (input.isMain) {
      await tx
        .update(clientMedicalContacts)
        .set({ isMain: false, updatedAt: now })
        .where(
          and(
            eq(clientMedicalContacts.clientId, input.clientId),
            eq(clientMedicalContacts.practiceId, input.practiceId)
          )
        )
    }

    await tx
      .update(clientMedicalContacts)
      .set({
        isMain: input.isMain,
        notes: input.notes?.trim() || null,
        updatedAt: now,
      })
      .where(eq(clientMedicalContacts.medicalContactId, input.medicalContactId))

    await tx.insert(auditEvents).values({
      practiceId: input.practiceId,
      userId: input.userId,
      clientId: input.clientId,
      eventType: "client_medical_contact.updated",
      entityType: "client_medical_contact",
      entityId: input.medicalContactId,
    })

    return {}
  })
}

export async function deleteMedicalContact(input: {
  clientId: string
  practiceId: string
  userId: string
  medicalContactId: string
}): Promise<{ error?: string }> {
  const [target] = await db
    .select({
      medicalContactId: clientMedicalContacts.medicalContactId,
      professionalId: clientMedicalContacts.professionalId,
    })
    .from(clientMedicalContacts)
    .where(
      and(
        eq(clientMedicalContacts.medicalContactId, input.medicalContactId),
        eq(clientMedicalContacts.clientId, input.clientId),
        eq(clientMedicalContacts.practiceId, input.practiceId)
      )
    )
    .limit(1)

  if (!target) return { error: "Medical contact not found." }

  const eventRows = await db
    .select()
    .from(clientEventRecords)
    .where(
      and(
        eq(clientEventRecords.clientId, input.clientId),
        eq(clientEventRecords.practiceId, input.practiceId),
        eq(clientEventRecords.eventType, "medication")
      )
    )
  const events = eventRows.map((row) => toEvent(row))
  if (medicalContactSupervisesHistoryMedication(events, target.professionalId)) {
    return { error: MEDICAL_CONTACT_IN_USE_MESSAGE }
  }

  await db
    .delete(clientMedicalContacts)
    .where(eq(clientMedicalContacts.medicalContactId, input.medicalContactId))

  await db.insert(auditEvents).values({
    practiceId: input.practiceId,
    userId: input.userId,
    clientId: input.clientId,
    eventType: "client_medical_contact.deleted",
    entityType: "client_medical_contact",
    entityId: input.medicalContactId,
  })

  return {}
}
