import "server-only"

import { and, eq } from "drizzle-orm"

import { claims, claimTypes, clients } from "@/db/schema"
import { db } from "@/lib/db"
import {
  findConflictingActiveMedicareOrNdisClaim,
  isMedicareClaim,
} from "@/lib/funding/format"

export type SaveMedicareClaimInput = {
  clientId: string
  practiceId: string
  medicareCardNumber: string | null
  medicareIrn: string | null
  medicareExpiry: string | null
}

/**
 * Create or update the client's active Medicare claim.
 * Confirms the client belongs to the practice before any claim read/write.
 * Uniqueness is also enforced by the DB trigger.
 */
export async function saveMedicareClaimDetails(
  input: SaveMedicareClaimInput
): Promise<{ error?: string; claimId?: string; created?: boolean }> {
  const [client] = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, input.clientId),
        eq(clients.practiceId, input.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)
  if (!client) return { error: "Client was not found." }

  const [medicareType] = await db
    .select({
      claimTypeId: claimTypes.claimTypeId,
      code: claimTypes.code,
    })
    .from(claimTypes)
    .where(
      and(
        eq(claimTypes.practiceId, input.practiceId),
        eq(claimTypes.isActive, true),
        eq(claimTypes.code, "medicare")
      )
    )
    .limit(1)

  if (!medicareType || !isMedicareClaim(medicareType.code)) {
    return { error: "No Medicare claim type is set up for this practice." }
  }

  const existingRows = await db
    .select({
      claimId: claims.claimId,
      clientId: claims.clientId,
      isActive: claims.isActive,
      claimTypeId: claims.claimTypeId,
      code: claimTypes.code,
    })
    .from(claims)
    .innerJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .where(and(eq(claims.clientId, input.clientId), eq(claims.practiceId, input.practiceId)))

  const activeMedicare = existingRows.find(
    (row) => row.isActive && isMedicareClaim(row.code)
  )

  const conflict = findConflictingActiveMedicareOrNdisClaim({
    clientId: input.clientId,
    claimId: activeMedicare?.claimId,
    claimTypeCode: "medicare",
    existingActiveClaims: existingRows.map((row) => ({
      claimId: row.claimId,
      clientId: row.clientId,
      isActive: row.isActive,
      claimTypeCode: row.code,
    })),
  })
  if (conflict.conflict && !activeMedicare) {
    return { error: conflict.message }
  }

  const now = new Date()
  if (activeMedicare) {
    await db
      .update(claims)
      .set({
        medicareCardNumber: input.medicareCardNumber,
        medicareIrn: input.medicareIrn,
        medicareExpiry: input.medicareExpiry,
        updatedAt: now,
      })
      .where(eq(claims.claimId, activeMedicare.claimId))
    return { claimId: activeMedicare.claimId, created: false }
  }

  const [created] = await db
    .insert(claims)
    .values({
      practiceId: input.practiceId,
      clientId: input.clientId,
      claimTypeId: medicareType.claimTypeId,
      medicareCardNumber: input.medicareCardNumber,
      medicareIrn: input.medicareIrn,
      medicareExpiry: input.medicareExpiry,
      isActive: true,
      updatedAt: now,
    })
    .returning({ claimId: claims.claimId })

  return { claimId: created.claimId, created: true }
}
