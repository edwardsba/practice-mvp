import "server-only"

import { and, eq, inArray, or } from "drizzle-orm"

import { auditEvents, clientBackgrounds, clientEventRecords, clientPartnershipRecords, clientRelationshipRecords, clients } from "@/db/schema"
import { db } from "@/lib/db"
import { toEvent, toPartnership, toRelationship } from "@/lib/client-background/map"
import {
  sanitizeEducation,
  sanitizeEvent,
  sanitizeIdentity,
  sanitizeLivingSituation,
  sanitizeOccupation,
  sanitizePartnership,
  sanitizeRelationship,
  sanitizeRisk,
} from "@/lib/client-background/sanitize"
import {
  emptyEvent,
  type CreateRelationshipInput,
  type EducationFields,
  type EventRecord,
  type EventType,
  type IdentityFields,
  type LivingSituationFields,
  type OccupationFields,
  type PartnershipRecord,
  type RelationshipRecord,
  type RelationshipToClient,
  type RiskRatings,
} from "@/lib/client-background/types"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type MutationResult<T> = { error?: string } & T

const ORIGIN_ROLES = ["mother", "father", "parent"] as const
const PARTNER_ROLES = ["current_partner", "prior_partner"] as const

async function assertClient(clientId: string, practiceId: string) {
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

async function writeAudit(
  tx: Tx,
  input: {
    practiceId: string
    userId: string
    clientId: string
    eventType: string
    entityType: string
    entityId: string
  }
) {
  await tx.insert(auditEvents).values(input)
}

async function nextRelationshipOrder(tx: Tx, clientId: string, practiceId: string) {
  const rows = await tx
    .select({ displayOrder: clientRelationshipRecords.displayOrder })
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.clientId, clientId),
        eq(clientRelationshipRecords.practiceId, practiceId)
      )
    )
  return rows.reduce((max, row) => Math.max(max, row.displayOrder), -1) + 1
}

async function nextEventOrder(tx: Tx, clientId: string, practiceId: string, eventType: string) {
  const rows = await tx
    .select({ displayOrder: clientEventRecords.displayOrder })
    .from(clientEventRecords)
    .where(
      and(
        eq(clientEventRecords.clientId, clientId),
        eq(clientEventRecords.practiceId, practiceId),
        eq(clientEventRecords.eventType, eventType)
      )
    )
  return rows.reduce((max, row) => Math.max(max, row.displayOrder), -1) + 1
}

function relationshipColumns(record: RelationshipRecord) {
  return {
    relationshipToClient: record.relationshipToClient,
    gender: record.gender || null,
    givenName: record.givenName || null,
    displayOrder: record.displayOrder,
    age: record.age,
    deceased: record.deceased,
    ageAtDeath: record.ageAtDeath,
    healthOrCauseOfDeath: record.healthOrCauseOfDeath || null,
    lengthOfRelationship: record.lengthOfRelationship || null,
    relationshipStatus: record.relationshipStatus || null,
    timeSinceEnded: record.timeSinceEnded || null,
    qualityOfRelationship: record.qualityOfRelationship || null,
    dependency: record.dependency || null,
    livingSituation: record.livingSituation || null,
    linkedPartnerRecordId: record.linkedPartnerRecordId,
    partnershipRecordId: record.partnershipRecordId,
    updatedAt: new Date(),
  }
}

function clearInapplicableLinks(record: RelationshipRecord): RelationshipRecord {
  const next = { ...record }
  const isChild = next.relationshipToClient === "child_biological" || next.relationshipToClient === "child_step"
  const keepsPartnershipLink =
    next.relationshipToClient === "sibling_full" ||
    next.relationshipToClient === "sibling_half" ||
    next.relationshipToClient === "sibling_step"
  const isPartner =
    next.relationshipToClient === "current_partner" || next.relationshipToClient === "prior_partner"
  if (!isChild) next.linkedPartnerRecordId = null
  if (!keepsPartnershipLink) next.partnershipRecordId = null
  if (!isPartner) next.relationshipStatus = ""
  if (next.relationshipToClient !== "prior_partner") next.timeSinceEnded = ""
  return next
}

async function ownedRelationship(tx: Tx, id: string, clientId: string, practiceId: string) {
  const [row] = await tx
    .select()
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.relationshipRecordId, id),
        eq(clientRelationshipRecords.clientId, clientId),
        eq(clientRelationshipRecords.practiceId, practiceId)
      )
    )
    .limit(1)
  return row ?? null
}

async function ensureOriginPartnership(tx: Tx, clientId: string, practiceId: string, userId: string) {
  const parents = await tx
    .select()
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.clientId, clientId),
        eq(clientRelationshipRecords.practiceId, practiceId),
        inArray(clientRelationshipRecords.relationshipToClient, [...ORIGIN_ROLES])
      )
    )
  if (parents.length !== 2) return null
  const [first, second] = parents
  const [existing] = await tx
    .select()
    .from(clientPartnershipRecords)
    .where(
      and(
        eq(clientPartnershipRecords.clientId, clientId),
        eq(clientPartnershipRecords.practiceId, practiceId),
        or(
          and(
            eq(clientPartnershipRecords.partnerAId, first.relationshipRecordId),
            eq(clientPartnershipRecords.partnerBId, second.relationshipRecordId)
          ),
          and(
            eq(clientPartnershipRecords.partnerAId, second.relationshipRecordId),
            eq(clientPartnershipRecords.partnerBId, first.relationshipRecordId)
          )
        )
      )
    )
    .limit(1)
  if (existing) return toPartnership(existing)

  const [created] = await tx
    .insert(clientPartnershipRecords)
    .values({
      clientId,
      practiceId,
      partnerAId: first.relationshipRecordId,
      partnerBId: second.relationshipRecordId,
    })
    .returning()

  await writeAudit(tx, {
    practiceId,
    userId,
    clientId,
    eventType: "client_partnership.created",
    entityType: "client_partnership",
    entityId: created.partnershipRecordId,
  })
  return toPartnership(created)
}

async function upsertBackgroundColumn(
  clientId: string,
  practiceId: string,
  userId: string,
  patch: Partial<{
    identityJson: IdentityFields
    livingSituationJson: LivingSituationFields
    educationJson: EducationFields
    occupationJson: OccupationFields
    riskJson: RiskRatings
  }>
) {
  const client = await assertClient(clientId, practiceId)
  if (!client) return { error: "Client was not found." }

  const now = new Date()
  let entityId = ""

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        clientBackgroundId: clientBackgrounds.clientBackgroundId,
        practiceId: clientBackgrounds.practiceId,
      })
      .from(clientBackgrounds)
      .where(eq(clientBackgrounds.clientId, clientId))
      .limit(1)

    if (existing && existing.practiceId !== practiceId) {
      throw new Error("practice_mismatch")
    }

    if (!existing) {
      const [created] = await tx
        .insert(clientBackgrounds)
        .values({
          clientId,
          practiceId,
          ...patch,
          updatedAt: now,
        })
        .returning({ clientBackgroundId: clientBackgrounds.clientBackgroundId })
      entityId = created.clientBackgroundId
    } else {
      entityId = existing.clientBackgroundId
      await tx
        .update(clientBackgrounds)
        .set({ ...patch, updatedAt: now })
        .where(eq(clientBackgrounds.clientBackgroundId, existing.clientBackgroundId))
    }

    await writeAudit(tx, {
      practiceId,
      userId,
      clientId,
      eventType: "client_background.updated",
      entityType: "client_background",
      entityId,
    })
  })

  return { error: undefined }
}

export async function saveIdentity(
  input: { clientId: string; practiceId: string; userId: string; identity: unknown }
) {
  const identity = sanitizeIdentity(input.identity)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      identityJson: identity,
    })
    return { ...result, identity }
  } catch {
    return { error: "Could not save identity." }
  }
}

export async function saveLivingSituation(
  input: { clientId: string; practiceId: string; userId: string; livingSituation: unknown }
) {
  const livingSituation = sanitizeLivingSituation(input.livingSituation)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      livingSituationJson: livingSituation,
    })
    return { ...result, livingSituation }
  } catch {
    return { error: "Could not save living situation." }
  }
}

export async function saveEducation(
  input: { clientId: string; practiceId: string; userId: string; education: unknown }
) {
  const education = sanitizeEducation(input.education)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      educationJson: education,
    })
    return { ...result, education }
  } catch {
    return { error: "Could not save education." }
  }
}

export async function saveOccupation(
  input: { clientId: string; practiceId: string; userId: string; occupation: unknown }
) {
  const occupation = sanitizeOccupation(input.occupation)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      occupationJson: occupation,
    })
    return { ...result, occupation }
  } catch {
    return { error: "Could not save occupation and financial concerns." }
  }
}

export async function saveRisk(
  input: { clientId: string; practiceId: string; userId: string; risk: unknown }
) {
  const risk = sanitizeRisk(input.risk)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      riskJson: risk,
    })
    return { ...result, risk }
  } catch {
    return { error: "Could not save risk ratings." }
  }
}

export async function createRelationship(input: {
  clientId: string
  practiceId: string
  userId: string
  spec: CreateRelationshipInput
}): Promise<MutationResult<{ relationship?: RelationshipRecord; partnerships?: PartnershipRecord[] }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  try {
    return await db.transaction(async (tx) => {
      const displayOrder = await nextRelationshipOrder(tx, input.clientId, input.practiceId)
      let role: RelationshipToClient = "parent"
      let linkedPartnerRecordId: string | null = null
      let partnershipRecordId: string | null = null
      let stepParentAnchorId: string | null = null

      if (input.spec.kind === "parent") role = input.spec.role
      if (input.spec.kind === "partner") role = input.spec.role
      if (input.spec.kind === "unlinked_child") role = input.spec.role
      if (input.spec.kind === "step_parent") {
        role = "step_parent"
        const parent = await ownedRelationship(tx, input.spec.parentRecordId, input.clientId, input.practiceId)
        if (!parent || (parent.relationshipToClient !== "mother" && parent.relationshipToClient !== "father")) {
          return { error: "A step-parent can only be added from a mother or father." }
        }
        stepParentAnchorId = parent.relationshipRecordId
      }
      if (input.spec.kind === "full_sibling") {
        role = "sibling_full"
        if (input.spec.partnershipRecordId) {
          const [partnership] = await tx
            .select()
            .from(clientPartnershipRecords)
            .where(
              and(
                eq(clientPartnershipRecords.partnershipRecordId, input.spec.partnershipRecordId),
                eq(clientPartnershipRecords.clientId, input.clientId),
                eq(clientPartnershipRecords.practiceId, input.practiceId)
              )
            )
            .limit(1)
          if (!partnership) return { error: "That parent partnership was not found." }
          const ends = await tx
            .select({ relationshipToClient: clientRelationshipRecords.relationshipToClient })
            .from(clientRelationshipRecords)
            .where(
              inArray(clientRelationshipRecords.relationshipRecordId, [
                partnership.partnerAId,
                partnership.partnerBId,
              ])
            )
          const bothOrigin =
            ends.length === 2 &&
            ends.every((row) => (ORIGIN_ROLES as readonly string[]).includes(row.relationshipToClient))
          if (!bothOrigin) return { error: "Full siblings link to the parents' partnership." }
          partnershipRecordId = partnership.partnershipRecordId
        }
      }
      if (input.spec.kind === "child") {
        role = input.spec.role
        const partner = await ownedRelationship(tx, input.spec.partnerRecordId, input.clientId, input.practiceId)
        if (!partner || !(PARTNER_ROLES as readonly string[]).includes(partner.relationshipToClient)) {
          return { error: "Choose a current or prior partner for this child." }
        }
        linkedPartnerRecordId = partner.relationshipRecordId
      }
      if (input.spec.kind === "step_sibling") {
        role = input.spec.role
        const [partnership] = await tx
          .select()
          .from(clientPartnershipRecords)
          .where(
            and(
              eq(clientPartnershipRecords.partnershipRecordId, input.spec.partnershipRecordId),
              eq(clientPartnershipRecords.clientId, input.clientId),
              eq(clientPartnershipRecords.practiceId, input.practiceId)
            )
          )
          .limit(1)
        if (!partnership) return { error: "That partnership was not found." }
        const ends = await tx
          .select()
          .from(clientRelationshipRecords)
          .where(
            inArray(clientRelationshipRecords.relationshipRecordId, [
              partnership.partnerAId,
              partnership.partnerBId,
            ])
          )
        if (!ends.some((row) => row.relationshipToClient === "step_parent")) {
          return { error: "Step-siblings are added under a step-parent." }
        }
        partnershipRecordId = partnership.partnershipRecordId
      }

      const [created] = await tx
        .insert(clientRelationshipRecords)
        .values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          relationshipToClient: role,
          displayOrder,
          linkedPartnerRecordId,
          partnershipRecordId,
        })
        .returning()

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_relationship.created",
        entityType: "client_relationship",
        entityId: created.relationshipRecordId,
      })

      const createdPartnerships: PartnershipRecord[] = []

      if (stepParentAnchorId) {
        const [partnership] = await tx
          .insert(clientPartnershipRecords)
          .values({
            clientId: input.clientId,
            practiceId: input.practiceId,
            partnerAId: stepParentAnchorId,
            partnerBId: created.relationshipRecordId,
          })
          .returning()
        await writeAudit(tx, {
          practiceId: input.practiceId,
          userId: input.userId,
          clientId: input.clientId,
          eventType: "client_partnership.created",
          entityType: "client_partnership",
          entityId: partnership.partnershipRecordId,
        })
        createdPartnerships.push(toPartnership(partnership))
      }

      if (input.spec.kind === "parent") {
        const origin = await ensureOriginPartnership(tx, input.clientId, input.practiceId, input.userId)
        if (origin) createdPartnerships.push(origin)
      }

      return {
        relationship: toRelationship(created),
        partnerships: createdPartnerships,
      }
    })
  } catch {
    return { error: "Could not add this person." }
  }
}

export async function updateRelationshipDetail(input: {
  clientId: string
  practiceId: string
  userId: string
  relationship: unknown
  partnerships: unknown
}): Promise<MutationResult<{ relationship?: RelationshipRecord; partnerships?: PartnershipRecord[] }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  const draft = clearInapplicableLinks(sanitizeRelationship(input.relationship))
  if (!draft.relationshipRecordId) return { error: "That person was not found." }
  const partnershipDrafts = Array.isArray(input.partnerships)
    ? input.partnerships.map((item) => sanitizePartnership(item))
    : []

  try {
    return await db.transaction(async (tx) => {
      const existing = await ownedRelationship(
        tx,
        draft.relationshipRecordId,
        input.clientId,
        input.practiceId
      )
      if (!existing) return { error: "That person was not found." }

      if (draft.linkedPartnerRecordId) {
        const partner = await ownedRelationship(
          tx,
          draft.linkedPartnerRecordId,
          input.clientId,
          input.practiceId
        )
        if (!partner || !(PARTNER_ROLES as readonly string[]).includes(partner.relationshipToClient)) {
          return { error: "That child is not linked to a partner on this client." }
        }
      }

      if (draft.partnershipRecordId) {
        const [partnership] = await tx
          .select()
          .from(clientPartnershipRecords)
          .where(
            and(
              eq(clientPartnershipRecords.partnershipRecordId, draft.partnershipRecordId),
              eq(clientPartnershipRecords.clientId, input.clientId),
              eq(clientPartnershipRecords.practiceId, input.practiceId)
            )
          )
          .limit(1)
        if (!partnership) return { error: "That sibling partnership was not found." }
      }

      const [updated] = await tx
        .update(clientRelationshipRecords)
        .set(relationshipColumns({ ...draft, displayOrder: existing.displayOrder }))
        .where(eq(clientRelationshipRecords.relationshipRecordId, existing.relationshipRecordId))
        .returning()

      const savedPartnerships: PartnershipRecord[] = []
      for (const partnership of partnershipDrafts) {
        const [owned] = await tx
          .select()
          .from(clientPartnershipRecords)
          .where(
            and(
              eq(clientPartnershipRecords.partnershipRecordId, partnership.partnershipRecordId),
              eq(clientPartnershipRecords.clientId, input.clientId),
              eq(clientPartnershipRecords.practiceId, input.practiceId)
            )
          )
          .limit(1)
        if (!owned) continue
        const involvesPerson =
          owned.partnerAId === existing.relationshipRecordId ||
          owned.partnerBId === existing.relationshipRecordId
        if (!involvesPerson) continue
        const [saved] = await tx
          .update(clientPartnershipRecords)
          .set({
            relationshipStatus: partnership.relationshipStatus || null,
            started: partnership.started || null,
            ended: partnership.ended || null,
            qualityOfRelationship: partnership.qualityOfRelationship || null,
            updatedAt: new Date(),
          })
          .where(eq(clientPartnershipRecords.partnershipRecordId, owned.partnershipRecordId))
          .returning()
        savedPartnerships.push(toPartnership(saved))
        await writeAudit(tx, {
          practiceId: input.practiceId,
          userId: input.userId,
          clientId: input.clientId,
          eventType: "client_partnership.updated",
          entityType: "client_partnership",
          entityId: saved.partnershipRecordId,
        })
      }

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_relationship.updated",
        entityType: "client_relationship",
        entityId: updated.relationshipRecordId,
      })

      return { relationship: toRelationship(updated), partnerships: savedPartnerships }
    })
  } catch {
    return { error: "Could not save this person." }
  }
}

export async function deleteRelationship(input: {
  clientId: string
  practiceId: string
  userId: string
  relationshipRecordId: string
}) {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  try {
    return await db.transaction(async (tx) => {
      const existing = await ownedRelationship(
        tx,
        input.relationshipRecordId,
        input.clientId,
        input.practiceId
      )
      if (!existing) return { error: "That person was not found." }

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_relationship.deleted",
        entityType: "client_relationship",
        entityId: existing.relationshipRecordId,
      })

      await tx
        .delete(clientRelationshipRecords)
        .where(eq(clientRelationshipRecords.relationshipRecordId, existing.relationshipRecordId))

      return {}
    })
  } catch {
    return { error: "Could not remove this person." }
  }
}

function eventColumns(event: EventRecord) {
  return {
    eventType: event.eventType,
    description: event.description || null,
    startPrecision: event.startPrecision || null,
    startValue: event.startValue || null,
    endPrecision: event.endPrecision || null,
    endValue: event.endValue || null,
    endOngoing: event.endOngoing,
    resolvedOrOngoing: event.resolvedOrOngoing || null,
    severityImpact: event.severityImpact || null,
    treated: event.treated,
    treatmentType: event.treatmentType || null,
    treatmentDetail: event.treatmentDetail || null,
    outcome: event.outcome || null,
    attribution: event.attribution,
    familyRelation: event.familyRelation || null,
    familySide: event.familySide || null,
    relationshipRecordId: event.relationshipRecordId,
    selfHarmType: event.selfHarmType || null,
    substanceInvolvement: event.substanceInvolvement,
    requiredMedicalAttention: event.requiredMedicalAttention,
    requiredHospitalisation: event.requiredHospitalisation,
    substanceStatus: event.substanceStatus || null,
    abstinentSincePrecision: event.abstinentSincePrecision || null,
    abstinentSinceValue: event.abstinentSinceValue || null,
    displayOrder: event.displayOrder,
    updatedAt: new Date(),
  }
}

export async function createEvent(input: {
  clientId: string
  practiceId: string
  userId: string
  eventType: EventType
}): Promise<MutationResult<{ event?: EventRecord }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  try {
    return await db.transaction(async (tx) => {
      const displayOrder = await nextEventOrder(tx, input.clientId, input.practiceId, input.eventType)
      const draft = emptyEvent(input.eventType, displayOrder)
      const [created] = await tx
        .insert(clientEventRecords)
        .values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          ...eventColumns({ ...draft, eventRecordId: "" }),
        })
        .returning()
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_event.created",
        entityType: "client_event",
        entityId: created.eventRecordId,
      })
      return { event: toEvent(created) }
    })
  } catch {
    return { error: "Could not add this entry." }
  }
}

export async function updateEvent(input: {
  clientId: string
  practiceId: string
  userId: string
  event: unknown
}): Promise<MutationResult<{ event?: EventRecord }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const draft = sanitizeEvent(input.event)
  if (!draft.eventRecordId) return { error: "That entry was not found." }

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(clientEventRecords)
        .where(
          and(
            eq(clientEventRecords.eventRecordId, draft.eventRecordId),
            eq(clientEventRecords.clientId, input.clientId),
            eq(clientEventRecords.practiceId, input.practiceId)
          )
        )
        .limit(1)
      if (!existing) return { error: "That entry was not found." }

      if (draft.relationshipRecordId) {
        const linked = await ownedRelationship(tx, draft.relationshipRecordId, input.clientId, input.practiceId)
        if (!linked) return { error: "That family member was not found on this client." }
      }

      const [updated] = await tx
        .update(clientEventRecords)
        .set(eventColumns({ ...draft, displayOrder: existing.displayOrder }))
        .where(eq(clientEventRecords.eventRecordId, existing.eventRecordId))
        .returning()

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_event.updated",
        entityType: "client_event",
        entityId: updated.eventRecordId,
      })
      return { event: toEvent(updated) }
    })
  } catch {
    return { error: "Could not save this entry." }
  }
}

export async function deleteEvent(input: {
  clientId: string
  practiceId: string
  userId: string
  eventRecordId: string
}) {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(clientEventRecords)
        .where(
          and(
            eq(clientEventRecords.eventRecordId, input.eventRecordId),
            eq(clientEventRecords.clientId, input.clientId),
            eq(clientEventRecords.practiceId, input.practiceId)
          )
        )
        .limit(1)
      if (!existing) return { error: "That entry was not found." }

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_event.deleted",
        entityType: "client_event",
        entityId: existing.eventRecordId,
      })
      await tx.delete(clientEventRecords).where(eq(clientEventRecords.eventRecordId, existing.eventRecordId))
      return {}
    })
  } catch {
    return { error: "Could not remove this entry." }
  }
}
