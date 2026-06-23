"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auditEvents, clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

const VALID_CLIENT_STATUSES = [
  "active",
  "on_hold",
  "discharged",
  "inactive",
] as const

export async function updateClientStatus(
  clientId: string,
  newStatus: string
): Promise<{ error?: string }> {
  const context = await requirePractitionerContext()

  if (
    !VALID_CLIENT_STATUSES.includes(
      newStatus as (typeof VALID_CLIENT_STATUSES)[number]
    )
  ) {
    return { error: "Invalid status." }
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

  await db.transaction(async (tx) => {
    await tx
      .update(clients)
      .set({
        clientStatus: newStatus,
        updatedAt: now,
      })
      .where(eq(clients.clientId, clientId))

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "client.status_changed",
      entityType: "client",
      entityId: clientId,
    })
  })

  revalidatePath(`/clients/${clientId}`)
  revalidatePath("/clients")

  return {}
}
