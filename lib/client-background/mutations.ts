import "server-only"

import { and, eq, inArray, or } from "drizzle-orm"

import { auditEvents, assessmentDefinitions, assessmentInstances, assessmentResults, clientBackgroundInterviews, clientBackgrounds, clientEventRecords, clientPartnershipRecords, clientRelationshipRecords, clients, professionals } from "@/db/schema"
import { BACKGROUND_ASSESSMENT_CODE } from "@/lib/background-questionnaire/types"
import { db } from "@/lib/db"
import { settleEventDates } from "@/lib/client-background/age"
import { toClientRelationshipStatus, toEvent, toPartnership, toRelationship } from "@/lib/client-background/map"
import {
  finalScreeningAnswers,
  sanitizeScreening,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import {
  demographicsFromStored,
  sanitizeClientRelationshipStatus,
  markUnansweredMedicationAndStressors,
  markUnansweredReason,
  sanitizeEducation,
  sanitizeEvent,
  sanitizeIdentity,
  sanitizeLivingSituation,
  sanitizeMedication,
  sanitizeOccupation,
  sanitizePartnership,
  sanitizeReasonForAttending,
  sanitizeRelationship,
  sanitizeRisk,
  sanitizeStressors,
} from "@/lib/client-background/sanitize"
import {
  brokenLinksForRoleChange,
  originPartnerships,
  stepParentLinks,
  type BrokenLinks,
  type StepParentLink,
} from "@/lib/client-background/tree"
import { applyRelationshipVisibilityDefaults } from "@/lib/client-background/visibility"
import {
  emptyDemographics,
  type ClientRelationshipStatusValue,
  type EducationFields,
  type EventRecord,
  type IdentityFields,
  type LivingSituationFields,
  type MedicationRecord,
  type OccupationFields,
  type ReasonForAttending,
  type StressorsRecord,
  type PartnershipRecord,
  type RelationshipRecord,
  type RelationshipRelink,
  type RelationshipToClient,
  type RiskRatings,
} from "@/lib/client-background/types"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type MutationResult<T> = { error?: string } & T

const ORIGIN_ROLES = ["mother", "father", "parent"] as const
const PARTNER_ROLES = ["current_partner", "prior_partner"] as const

type WriteContext = {
  clientId: string
  practiceId: string
  userId: string
}

export type RelationshipWriteResult = {
  relationship?: RelationshipRecord
  partnerships?: PartnershipRecord[]
  affectedRelationships?: RelationshipRecord[]
  removedPartnershipIds?: string[]
  clientRelationshipStatus?: ClientRelationshipStatusValue
}

function isOriginRole(role: string): boolean {
  return (ORIGIN_ROLES as readonly string[]).includes(role)
}

function isPartnerRole(role: string): boolean {
  return (PARTNER_ROLES as readonly string[]).includes(role)
}

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
    sex: record.sex || null,
    givenName: record.givenName || null,
    displayOrder: record.displayOrder,
    dateOfBirth: record.dateOfBirth || null,
    approximateAge: null,
    approximateAgeRecordedOn: null,
    deceased: record.healthStatus === "deceased",
    healthStatus: record.healthStatus || null,
    ageAtDeath: record.ageAtDeath,
    dateOfDeath: record.dateOfDeath || null,
    healthOrCauseOfDeath: record.healthOrCauseOfDeath || null,
    lengthOfRelationship: record.lengthOfRelationship || null,
    relationshipStatus: record.relationshipStatus || null,
    timeSinceEnded: record.timeSinceEnded || null,
    supportive: record.supportive || null,
    conflict: record.conflict || null,
    qualityOfRelationship: record.qualityOfRelationship || null,
    dependency: record.dependency || null,
    livingSituation: record.livingSituation || null,
    caregiverRelationship: record.caregiverRelationship || null,
    linkedPartnerRecordId: record.linkedPartnerRecordId,
    partnershipRecordId: record.partnershipRecordId,
    updatedAt: new Date(),
  }
}

function clearInapplicableLinks(record: RelationshipRecord): RelationshipRecord {
  const next = applyRelationshipVisibilityDefaults(record)
  const isChild = next.relationshipToClient === "child_biological" || next.relationshipToClient === "child_step"
  const keepsPartnershipLink =
    next.relationshipToClient === "sibling_full" ||
    next.relationshipToClient === "sibling_half" ||
    next.relationshipToClient === "sibling_step"
  if (!isChild) next.linkedPartnerRecordId = null
  if (!keepsPartnershipLink) next.partnershipRecordId = null
  if (next.relationshipToClient !== "other_caregiver") next.caregiverRelationship = ""
  return next
}

async function writeClientRelationshipStatus(
  tx: Tx,
  input: WriteContext & ClientRelationshipStatusValue
): Promise<ClientRelationshipStatusValue> {
  const now = new Date()
  const [existing] = await tx
    .select({
      clientBackgroundId: clientBackgrounds.clientBackgroundId,
      practiceId: clientBackgrounds.practiceId,
    })
    .from(clientBackgrounds)
    .where(eq(clientBackgrounds.clientId, input.clientId))
    .limit(1)

  if (existing && existing.practiceId !== input.practiceId) {
    throw new Error("practice_mismatch")
  }

  const values = {
    relationshipStatus: input.relationshipStatus || null,
    relationshipStatusOther: input.relationshipStatusOther || null,
    updatedAt: now,
  }

  let entityId = ""
  if (!existing) {
    const [created] = await tx
      .insert(clientBackgrounds)
      .values({
        clientId: input.clientId,
        practiceId: input.practiceId,
        ...values,
      })
      .returning({ clientBackgroundId: clientBackgrounds.clientBackgroundId })
    entityId = created.clientBackgroundId
  } else {
    entityId = existing.clientBackgroundId
    await tx
      .update(clientBackgrounds)
      .set(values)
      .where(eq(clientBackgrounds.clientBackgroundId, existing.clientBackgroundId))
  }

  await writeAudit(tx, {
    practiceId: input.practiceId,
    userId: input.userId,
    clientId: input.clientId,
    eventType: "client_background.updated",
    entityType: "client_background",
    entityId,
  })

  return {
    relationshipStatus: input.relationshipStatus,
    relationshipStatusOther: input.relationshipStatusOther,
  }
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

export async function ensureFamilyOfOrigin(input: {
  clientId: string
  practiceId: string
  userId: string
}): Promise<{ error?: string }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  try {
    await db.transaction(async (tx) => {
      const parents = await tx
        .select()
        .from(clientRelationshipRecords)
        .where(
          and(
            eq(clientRelationshipRecords.clientId, input.clientId),
            eq(clientRelationshipRecords.practiceId, input.practiceId),
            inArray(clientRelationshipRecords.relationshipToClient, ["mother", "father"])
          )
        )

      const earliest = (role: "mother" | "father") =>
        parents
          .filter((row) => row.relationshipToClient === role)
          .sort(
            (a, b) =>
              a.displayOrder - b.displayOrder || a.relationshipRecordId.localeCompare(b.relationshipRecordId)
          )[0]

      let mother = earliest("mother")
      let father = earliest("father")

      async function insertOrigin(role: "mother" | "father") {
        const displayOrder = await nextRelationshipOrder(tx, input.clientId, input.practiceId)
        const [created] = await tx
          .insert(clientRelationshipRecords)
          .values({
            clientId: input.clientId,
            practiceId: input.practiceId,
            relationshipToClient: role,
            displayOrder,
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
        return created
      }

      if (!mother) mother = await insertOrigin("mother")
      if (!father) father = await insertOrigin("father")

      const [existing] = await tx
        .select()
        .from(clientPartnershipRecords)
        .where(
          and(
            eq(clientPartnershipRecords.clientId, input.clientId),
            eq(clientPartnershipRecords.practiceId, input.practiceId),
            or(
              and(
                eq(clientPartnershipRecords.partnerAId, mother.relationshipRecordId),
                eq(clientPartnershipRecords.partnerBId, father.relationshipRecordId)
              ),
              and(
                eq(clientPartnershipRecords.partnerAId, father.relationshipRecordId),
                eq(clientPartnershipRecords.partnerBId, mother.relationshipRecordId)
              )
            )
          )
        )
        .limit(1)
      if (existing) return

      const [created] = await tx
        .insert(clientPartnershipRecords)
        .values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          partnerAId: mother.relationshipRecordId,
          partnerBId: father.relationshipRecordId,
        })
        .returning()
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_partnership.created",
        entityType: "client_partnership",
        entityId: created.partnershipRecordId,
      })
    })
    return {}
  } catch {
    return { error: "Could not prepare family of origin." }
  }
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
    medicationJson: MedicationRecord
    stressorsJson: StressorsRecord
    reasonForAttendingJson: ReasonForAttending
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

export async function saveDemographics(input: {
  clientId: string
  practiceId: string
  userId: string
  identity: unknown
  livingSituation: unknown
  education: unknown
  occupation: unknown
}) {
  const identity = sanitizeIdentity(input.identity)
  const livingSituation = sanitizeLivingSituation(input.livingSituation)
  const education = sanitizeEducation(input.education)
  const occupation = sanitizeOccupation(input.occupation)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      identityJson: identity,
      livingSituationJson: livingSituation,
      educationJson: education,
      occupationJson: occupation,
    })
    return {
      ...result,
      demographics: { identity, livingSituation, education, occupation },
    }
  } catch {
    return { error: "Could not save demographics." }
  }
}

export async function saveMedication(
  input: { clientId: string; practiceId: string; userId: string; medication: unknown }
) {
  const medication = sanitizeMedication(input.medication)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      medicationJson: medication,
    })
    return { ...result, medication }
  } catch {
    return { error: "Could not save medication." }
  }
}

export async function saveStressors(
  input: { clientId: string; practiceId: string; userId: string; stressors: unknown }
) {
  const stressors = sanitizeStressors(input.stressors)
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      stressorsJson: stressors,
    })
    return { ...result, stressors }
  } catch {
    return { error: "Could not save stressors." }
  }
}

async function professionalBelongsToPractice(professionalId: string, practiceId: string) {
  const [row] = await db
    .select({ professionalId: professionals.professionalId })
    .from(professionals)
    .where(and(eq(professionals.professionalId, professionalId), eq(professionals.practiceId, practiceId)))
    .limit(1)
  return row != null
}

export async function saveReasonForAttending(input: {
  clientId: string
  practiceId: string
  userId: string
  reason: unknown
}) {
  const reason = sanitizeReasonForAttending(input.reason)
  if (reason.referrerProfessionalId) {
    const allowed = await professionalBelongsToPractice(reason.referrerProfessionalId, input.practiceId)
    if (!allowed) return { error: "Choose a professional from this practice." }
  }
  try {
    const result = await upsertBackgroundColumn(input.clientId, input.practiceId, input.userId, {
      reasonForAttendingJson: reason,
    })
    return { ...result, reason }
  } catch {
    return { error: "Could not save reason for attending." }
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

export async function saveClientRelationshipStatus(input: {
  clientId: string
  practiceId: string
  userId: string
  relationshipStatus: unknown
}): Promise<{ error?: string } & Partial<ClientRelationshipStatusValue>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const status = sanitizeClientRelationshipStatus(input.relationshipStatus)
  try {
    const saved = await db.transaction((tx) =>
      writeClientRelationshipStatus(tx, {
        clientId: input.clientId,
        practiceId: input.practiceId,
        userId: input.userId,
        ...status,
      })
    )
    return { error: undefined, ...saved }
  } catch {
    return { error: "Could not save relationship status." }
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

async function loadFamily(tx: Tx, clientId: string, practiceId: string) {
  const relationshipRows = await tx
    .select()
    .from(clientRelationshipRecords)
    .where(
      and(eq(clientRelationshipRecords.clientId, clientId), eq(clientRelationshipRecords.practiceId, practiceId))
    )
  const partnershipRows = await tx
    .select()
    .from(clientPartnershipRecords)
    .where(
      and(eq(clientPartnershipRecords.clientId, clientId), eq(clientPartnershipRecords.practiceId, practiceId))
    )
  return {
    people: relationshipRows.map(toRelationship),
    partnerships: partnershipRows.map(toPartnership),
  }
}

function validateRelationshipLinks(input: {
  draft: RelationshipRecord
  people: RelationshipRecord[]
  partnerships: PartnershipRecord[]
  associatedParentId: string | null
  selfId: string | null
}): { error: string } | { draft: RelationshipRecord; associatedParentId: string | null } {
  const { people, partnerships, selfId } = input
  let draft = input.draft
  const role = draft.relationshipToClient

  if (role === "mother" || role === "father") {
    return { draft, associatedParentId: null }
  }

  if (role === "step_parent") {
    const parentId = input.associatedParentId
    const parent = parentId ? people.find((person) => person.relationshipRecordId === parentId) : undefined
    if (!parentId || !parent || !isOriginRole(parent.relationshipToClient) || parentId === selfId) {
      return { error: "Choose an associated parent." }
    }
    return { draft, associatedParentId: parentId }
  }

  if (role === "sibling_full") {
    const origins = originPartnerships(people, partnerships)
    if (draft.partnershipRecordId) {
      const match = origins.some((item) => item.partnershipRecordId === draft.partnershipRecordId)
      if (!match) return { error: "Choose the parents' partnership." }
    } else if (origins.length === 1) {
      draft = { ...draft, partnershipRecordId: origins[0].partnershipRecordId }
    } else if (origins.length > 1) {
      return { error: "Choose the parents' partnership." }
    }
    return { draft, associatedParentId: null }
  }

  if (role === "sibling_half" || role === "sibling_step") {
    const link = stepParentLinks(people, partnerships).find(
      (item) => item.partnershipRecordId === draft.partnershipRecordId
    )
    if (!draft.partnershipRecordId || !link || link.stepParent.relationshipRecordId === selfId) {
      return { error: "Choose an associated step-parent." }
    }
    return { draft, associatedParentId: null }
  }

  if (role === "child_biological" || role === "child_step") {
    if (role === "child_step" && !draft.linkedPartnerRecordId) {
      return { error: "Choose an associated partner." }
    }
    if (draft.linkedPartnerRecordId) {
      const partner = people.find((person) => person.relationshipRecordId === draft.linkedPartnerRecordId)
      if (
        !partner ||
        !isPartnerRole(partner.relationshipToClient) ||
        partner.relationshipRecordId === selfId
      ) {
        return { error: "Choose an associated partner." }
      }
    }
    return { draft, associatedParentId: null }
  }

  return { draft, associatedParentId: null }
}

function validateRelink(
  links: BrokenLinks | null,
  relink: RelationshipRelink | null,
  family: { people: RelationshipRecord[]; partnerships: PartnershipRecord[] },
  selfId: string
): string | null {
  if (!links) return null
  if (!relink) return "Choose where to move the people linked to this person."
  if (relink.action === "unlink") return null
  const target = family.people.find((person) => person.relationshipRecordId === relink.targetRecordId)
  if (!target || target.relationshipRecordId === selfId) {
    return "Choose where to move the people linked to this person."
  }
  if (links.kind === "siblings") {
    const linked = stepParentLinks(family.people, family.partnerships).some(
      (link) => link.stepParent.relationshipRecordId === target.relationshipRecordId
    )
    if (target.relationshipToClient !== "step_parent" || !linked) {
      return "Choose a step-parent to move them to."
    }
  }
  if (links.kind === "children" && !isPartnerRole(target.relationshipToClient)) {
    return "Choose a partner to move them to."
  }
  if (links.kind === "step-parents" && !isOriginRole(target.relationshipToClient)) {
    return "Choose a parent to move them to."
  }
  return null
}

async function setSiblingPartnership(
  tx: Tx,
  ctx: WriteContext,
  siblingId: string,
  partnershipRecordId: string | null
): Promise<RelationshipRecord | null> {
  const [row] = await tx
    .update(clientRelationshipRecords)
    .set({ partnershipRecordId, updatedAt: new Date() })
    .where(
      and(
        eq(clientRelationshipRecords.relationshipRecordId, siblingId),
        eq(clientRelationshipRecords.clientId, ctx.clientId),
        eq(clientRelationshipRecords.practiceId, ctx.practiceId)
      )
    )
    .returning()
  if (!row) return null
  await writeAudit(tx, {
    practiceId: ctx.practiceId,
    userId: ctx.userId,
    clientId: ctx.clientId,
    eventType: "client_relationship.updated",
    entityType: "client_relationship",
    entityId: row.relationshipRecordId,
  })
  return toRelationship(row)
}

async function setChildPartner(
  tx: Tx,
  ctx: WriteContext,
  childId: string,
  linkedPartnerRecordId: string | null
): Promise<RelationshipRecord | null> {
  const [row] = await tx
    .update(clientRelationshipRecords)
    .set({ linkedPartnerRecordId, updatedAt: new Date() })
    .where(
      and(
        eq(clientRelationshipRecords.relationshipRecordId, childId),
        eq(clientRelationshipRecords.clientId, ctx.clientId),
        eq(clientRelationshipRecords.practiceId, ctx.practiceId)
      )
    )
    .returning()
  if (!row) return null
  await writeAudit(tx, {
    practiceId: ctx.practiceId,
    userId: ctx.userId,
    clientId: ctx.clientId,
    eventType: "client_relationship.updated",
    entityType: "client_relationship",
    entityId: row.relationshipRecordId,
  })
  return toRelationship(row)
}

async function clearSiblingLinks(
  tx: Tx,
  ctx: WriteContext,
  partnershipRecordId: string
): Promise<RelationshipRecord[]> {
  const rows = await tx
    .update(clientRelationshipRecords)
    .set({ partnershipRecordId: null, updatedAt: new Date() })
    .where(
      and(
        eq(clientRelationshipRecords.partnershipRecordId, partnershipRecordId),
        eq(clientRelationshipRecords.clientId, ctx.clientId),
        eq(clientRelationshipRecords.practiceId, ctx.practiceId)
      )
    )
    .returning()
  const affected: RelationshipRecord[] = []
  for (const row of rows) {
    await writeAudit(tx, {
      practiceId: ctx.practiceId,
      userId: ctx.userId,
      clientId: ctx.clientId,
      eventType: "client_relationship.updated",
      entityType: "client_relationship",
      entityId: row.relationshipRecordId,
    })
    affected.push(toRelationship(row))
  }
  return affected
}

async function insertStepPartnership(
  tx: Tx,
  ctx: WriteContext,
  parentId: string,
  stepParentId: string
): Promise<PartnershipRecord> {
  const [partnership] = await tx
    .insert(clientPartnershipRecords)
    .values({
      clientId: ctx.clientId,
      practiceId: ctx.practiceId,
      partnerAId: parentId,
      partnerBId: stepParentId,
    })
    .returning()
  await writeAudit(tx, {
    practiceId: ctx.practiceId,
    userId: ctx.userId,
    clientId: ctx.clientId,
    eventType: "client_partnership.created",
    entityType: "client_partnership",
    entityId: partnership.partnershipRecordId,
  })
  return toPartnership(partnership)
}

async function retargetPartnershipParent(
  tx: Tx,
  ctx: WriteContext,
  link: StepParentLink,
  nextParentId: string,
  partnerships: PartnershipRecord[]
): Promise<PartnershipRecord> {
  const partnership = partnerships.find((item) => item.partnershipRecordId === link.partnershipRecordId)
  if (!partnership) throw new Error("Partnership was not found.")
  const parentIsA = partnership.partnerAId === link.parent.relationshipRecordId
  const [saved] = await tx
    .update(clientPartnershipRecords)
    .set({
      ...(parentIsA ? { partnerAId: nextParentId } : { partnerBId: nextParentId }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clientPartnershipRecords.partnershipRecordId, partnership.partnershipRecordId),
        eq(clientPartnershipRecords.clientId, ctx.clientId),
        eq(clientPartnershipRecords.practiceId, ctx.practiceId)
      )
    )
    .returning()
  await writeAudit(tx, {
    practiceId: ctx.practiceId,
    userId: ctx.userId,
    clientId: ctx.clientId,
    eventType: "client_partnership.updated",
    entityType: "client_partnership",
    entityId: saved.partnershipRecordId,
  })
  return toPartnership(saved)
}

async function deletePartnership(tx: Tx, ctx: WriteContext, partnershipRecordId: string) {
  await writeAudit(tx, {
    practiceId: ctx.practiceId,
    userId: ctx.userId,
    clientId: ctx.clientId,
    eventType: "client_partnership.deleted",
    entityType: "client_partnership",
    entityId: partnershipRecordId,
  })
  await tx
    .delete(clientPartnershipRecords)
    .where(
      and(
        eq(clientPartnershipRecords.partnershipRecordId, partnershipRecordId),
        eq(clientPartnershipRecords.clientId, ctx.clientId),
        eq(clientPartnershipRecords.practiceId, ctx.practiceId)
      )
    )
}

async function applyRelink(
  tx: Tx,
  ctx: WriteContext,
  input: {
    links: BrokenLinks
    relink: RelationshipRelink
    people: RelationshipRecord[]
    partnerships: PartnershipRecord[]
    selfId: string
  }
): Promise<{
  affected: RelationshipRecord[]
  partnerships: PartnershipRecord[]
  removedPartnershipIds: string[]
}> {
  const affected: RelationshipRecord[] = []
  const partnerships: PartnershipRecord[] = []
  const removedPartnershipIds: string[] = []
  const { links, relink, people, selfId } = input

  if (links.kind === "siblings") {
    const partnershipId =
      relink.action === "move"
        ? stepParentLinks(people, input.partnerships).find(
            (link) => link.stepParent.relationshipRecordId === relink.targetRecordId
          )?.partnershipRecordId
        : null
    if (relink.action === "move" && !partnershipId) throw new Error("Step-parent partnership was not found.")
    for (const sibling of links.people) {
      const updated = await setSiblingPartnership(
        tx,
        ctx,
        sibling.relationshipRecordId,
        relink.action === "move" ? partnershipId! : null
      )
      if (updated) affected.push(updated)
    }
  }

  if (links.kind === "children") {
    const targetId = relink.action === "move" ? relink.targetRecordId : null
    for (const child of links.people) {
      const updated = await setChildPartner(tx, ctx, child.relationshipRecordId, targetId)
      if (updated) affected.push(updated)
    }
  }

  if (links.kind === "step-parents") {
    const owned = stepParentLinks(people, input.partnerships).filter(
      (link) =>
        link.parent.relationshipRecordId === selfId &&
        links.people.some((person) => person.relationshipRecordId === link.stepParent.relationshipRecordId)
    )
    if (relink.action === "move") {
      for (const link of owned) {
        if (link.parent.relationshipRecordId === relink.targetRecordId) continue
        partnerships.push(
          await retargetPartnershipParent(tx, ctx, link, relink.targetRecordId, input.partnerships)
        )
      }
    } else {
      for (const link of owned) {
        affected.push(...(await clearSiblingLinks(tx, ctx, link.partnershipRecordId)))
        await deletePartnership(tx, ctx, link.partnershipRecordId)
        removedPartnershipIds.push(link.partnershipRecordId)
      }
    }
  }

  return { affected, partnerships, removedPartnershipIds }
}

export async function createRelationship(input: {
  clientId: string
  practiceId: string
  userId: string
  relationship: unknown
  associatedParentId?: string | null
  clientRelationshipStatus?: unknown
}): Promise<MutationResult<RelationshipWriteResult>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  const sanitized = clearInapplicableLinks(sanitizeRelationship(input.relationship))
  if (sanitized.relationshipToClient === "mother" || sanitized.relationshipToClient === "father") {
    return { error: "Mother and father stay on the client and are not chosen here." }
  }

  const ctx: WriteContext = {
    clientId: input.clientId,
    practiceId: input.practiceId,
    userId: input.userId,
  }

  try {
    return await db.transaction(async (tx) => {
      const family = await loadFamily(tx, input.clientId, input.practiceId)
      const validated = validateRelationshipLinks({
        draft: sanitized,
        people: family.people,
        partnerships: family.partnerships,
        associatedParentId: input.associatedParentId ?? null,
        selfId: null,
      })
      if ("error" in validated) return validated

      const displayOrder = await nextRelationshipOrder(tx, input.clientId, input.practiceId)
      const [created] = await tx
        .insert(clientRelationshipRecords)
        .values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          ...relationshipColumns({ ...validated.draft, displayOrder }),
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

      const partnerships: PartnershipRecord[] = []
      if (validated.draft.relationshipToClient === "step_parent" && validated.associatedParentId) {
        partnerships.push(
          await insertStepPartnership(tx, ctx, validated.associatedParentId, created.relationshipRecordId)
        )
      }
      if (validated.draft.relationshipToClient === "parent") {
        const origin = await ensureOriginPartnership(tx, input.clientId, input.practiceId, input.userId)
        if (origin) partnerships.push(origin)
      }

      const clientRelationshipStatus =
        validated.draft.relationshipToClient === "current_partner" && input.clientRelationshipStatus !== undefined
          ? await writeClientRelationshipStatus(tx, {
              ...ctx,
              ...sanitizeClientRelationshipStatus(input.clientRelationshipStatus),
            })
          : undefined

      return {
        relationship: toRelationship(created),
        partnerships,
        affectedRelationships: [],
        removedPartnershipIds: [],
        clientRelationshipStatus,
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
  associatedParentId?: string | null
  relink?: RelationshipRelink | null
  clientRelationshipStatus?: unknown
}): Promise<MutationResult<RelationshipWriteResult>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  let draft = clearInapplicableLinks(sanitizeRelationship(input.relationship))
  if (!draft.relationshipRecordId) return { error: "That person was not found." }
  const partnershipDrafts = Array.isArray(input.partnerships)
    ? input.partnerships.map((item) => sanitizePartnership(item))
    : []

  const ctx: WriteContext = {
    clientId: input.clientId,
    practiceId: input.practiceId,
    userId: input.userId,
  }

  try {
    return await db.transaction(async (tx) => {
      const existing = await ownedRelationship(tx, draft.relationshipRecordId, input.clientId, input.practiceId)
      if (!existing) return { error: "That person was not found." }

      if (existing.relationshipToClient === "mother" || existing.relationshipToClient === "father") {
        draft = clearInapplicableLinks({
          ...draft,
          relationshipToClient: existing.relationshipToClient as RelationshipToClient,
        })
      } else if (draft.relationshipToClient === "mother" || draft.relationshipToClient === "father") {
        return { error: "Mother and father stay on the client and are not chosen here." }
      }

      draft = { ...draft, displayOrder: existing.displayOrder }
      const family = await loadFamily(tx, input.clientId, input.practiceId)
      const existingRecord = family.people.find(
        (person) => person.relationshipRecordId === existing.relationshipRecordId
      )
      if (!existingRecord) return { error: "That person was not found." }

      const validated = validateRelationshipLinks({
        draft,
        people: family.people,
        partnerships: family.partnerships,
        associatedParentId: input.associatedParentId ?? null,
        selfId: existing.relationshipRecordId,
      })
      if ("error" in validated) return validated
      draft = validated.draft

      const links = brokenLinksForRoleChange(
        existingRecord,
        draft.relationshipToClient,
        family.people,
        family.partnerships
      )
      const relinkError = validateRelink(links, input.relink ?? null, family, existing.relationshipRecordId)
      if (relinkError) return { error: relinkError }

      const affected: RelationshipRecord[] = []
      const removed = new Set<string>()
      const savedPartnerships = new Map<string, PartnershipRecord>()

      if (links && input.relink) {
        const applied = await applyRelink(tx, ctx, {
          links,
          relink: input.relink,
          people: family.people,
          partnerships: family.partnerships,
          selfId: existing.relationshipRecordId,
        })
        affected.push(...applied.affected)
        for (const id of applied.removedPartnershipIds) removed.add(id)
        for (const partnership of applied.partnerships) {
          savedPartnerships.set(partnership.partnershipRecordId, partnership)
        }
      }

      const wasStep = existing.relationshipToClient === "step_parent"
      const nowStep = draft.relationshipToClient === "step_parent"
      const ownLinks = stepParentLinks(family.people, family.partnerships).filter(
        (link) => link.stepParent.relationshipRecordId === existing.relationshipRecordId
      )

      if (wasStep && nowStep) {
        if (ownLinks.length === 0 && validated.associatedParentId) {
          const created = await insertStepPartnership(
            tx,
            ctx,
            validated.associatedParentId,
            existing.relationshipRecordId
          )
          savedPartnerships.set(created.partnershipRecordId, created)
        } else if (
          ownLinks[0] &&
          validated.associatedParentId &&
          ownLinks[0].parent.relationshipRecordId !== validated.associatedParentId
        ) {
          const updated = await retargetPartnershipParent(
            tx,
            ctx,
            ownLinks[0],
            validated.associatedParentId,
            family.partnerships
          )
          savedPartnerships.set(updated.partnershipRecordId, updated)
        }
      } else if (wasStep && !nowStep) {
        for (const link of ownLinks) {
          if (removed.has(link.partnershipRecordId)) continue
          affected.push(...(await clearSiblingLinks(tx, ctx, link.partnershipRecordId)))
          await deletePartnership(tx, ctx, link.partnershipRecordId)
          removed.add(link.partnershipRecordId)
        }
      } else if (!wasStep && nowStep && validated.associatedParentId) {
        const created = await insertStepPartnership(
          tx,
          ctx,
          validated.associatedParentId,
          existing.relationshipRecordId
        )
        savedPartnerships.set(created.partnershipRecordId, created)
      }

      const [updated] = await tx
        .update(clientRelationshipRecords)
        .set(relationshipColumns(draft))
        .where(eq(clientRelationshipRecords.relationshipRecordId, existing.relationshipRecordId))
        .returning()

      for (const partnership of partnershipDrafts) {
        if (removed.has(partnership.partnershipRecordId)) continue
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
          owned.partnerAId === existing.relationshipRecordId || owned.partnerBId === existing.relationshipRecordId
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
        savedPartnerships.set(saved.partnershipRecordId, toPartnership(saved))
        await writeAudit(tx, {
          practiceId: input.practiceId,
          userId: input.userId,
          clientId: input.clientId,
          eventType: "client_partnership.updated",
          entityType: "client_partnership",
          entityId: saved.partnershipRecordId,
        })
      }

      if (draft.relationshipToClient === "parent") {
        const origin = await ensureOriginPartnership(tx, input.clientId, input.practiceId, input.userId)
        if (origin) savedPartnerships.set(origin.partnershipRecordId, origin)
      }

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_relationship.updated",
        entityType: "client_relationship",
        entityId: updated.relationshipRecordId,
      })

      const affectedById = new Map<string, RelationshipRecord>()
      for (const person of affected) {
        if (person.relationshipRecordId === updated.relationshipRecordId) continue
        affectedById.set(person.relationshipRecordId, person)
      }

      const clientRelationshipStatus =
        draft.relationshipToClient === "current_partner" && input.clientRelationshipStatus !== undefined
          ? await writeClientRelationshipStatus(tx, {
              ...ctx,
              ...sanitizeClientRelationshipStatus(input.clientRelationshipStatus),
            })
          : undefined

      return {
        relationship: toRelationship(updated),
        partnerships: [...savedPartnerships.values()],
        affectedRelationships: [...affectedById.values()],
        removedPartnershipIds: [...removed],
        clientRelationshipStatus,
      }
    })
  } catch {
    return { error: "Could not save this person." }
  }
}

export async function updatePartnership(input: {
  clientId: string
  practiceId: string
  userId: string
  partnership: unknown
}): Promise<MutationResult<{ partnership?: PartnershipRecord }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const draft = sanitizePartnership(input.partnership)
  if (!draft.partnershipRecordId) return { error: "That relationship was not found." }

  try {
    return await db.transaction(async (tx) => {
      const [owned] = await tx
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
      if (!owned) return { error: "That relationship was not found." }

      const [saved] = await tx
        .update(clientPartnershipRecords)
        .set({
          relationshipStatus: draft.relationshipStatus || null,
          started: draft.started || null,
          ended: draft.ended || null,
          qualityOfRelationship: draft.qualityOfRelationship || null,
          updatedAt: new Date(),
        })
        .where(eq(clientPartnershipRecords.partnershipRecordId, owned.partnershipRecordId))
        .returning()

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_partnership.updated",
        entityType: "client_partnership",
        entityId: saved.partnershipRecordId,
      })

      return { partnership: toPartnership(saved) }
    })
  } catch {
    return { error: "Could not save this relationship." }
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

      if (existing.relationshipToClient === "mother" || existing.relationshipToClient === "father") {
        const sameRole = await tx
          .select({ relationshipRecordId: clientRelationshipRecords.relationshipRecordId })
          .from(clientRelationshipRecords)
          .where(
            and(
              eq(clientRelationshipRecords.clientId, input.clientId),
              eq(clientRelationshipRecords.practiceId, input.practiceId),
              eq(clientRelationshipRecords.relationshipToClient, existing.relationshipToClient)
            )
          )
        if (sameRole.length <= 1) {
          return { error: "Mother and father stay on every client. Clear their details instead of removing them." }
        }
      }

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
    title: event.title || null,
    description: event.description || null,
    startPrecision: event.startPrecision || null,
    startValue: event.startValue || null,
    endPrecision: event.endPrecision || null,
    endValue: event.endValue || null,
    endOngoing: event.endOngoing,
    resolvedOrOngoing: event.resolvedOrOngoing || null,
    treated: event.treated,
    treatmentType: event.treatmentType || null,
    treatmentDetail: event.treatmentDetail || null,
    outcome: event.outcome || null,
    attribution: event.attribution,
    familyRelation: event.familyRelation || null,
    familySide: event.familySide || null,
    relationshipRecordId: event.relationshipRecordId,
    selfHarmType: event.selfHarmType || null,
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
  event: unknown
}): Promise<MutationResult<{ event?: EventRecord }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const parsed = sanitizeEvent(input.event)

  try {
    return await db.transaction(async (tx) => {
      const displayOrder = await nextEventOrder(tx, input.clientId, input.practiceId, parsed.eventType)
      const draft = { ...parsed, eventRecordId: "", displayOrder }
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

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}

async function inProgressInterview(clientId: string, practiceId: string) {
  const [row] = await db
    .select({ clientBackgroundInterviewId: clientBackgroundInterviews.clientBackgroundInterviewId })
    .from(clientBackgroundInterviews)
    .where(
      and(
        eq(clientBackgroundInterviews.clientId, clientId),
        eq(clientBackgroundInterviews.practiceId, practiceId),
        eq(clientBackgroundInterviews.status, "in_progress")
      )
    )
    .limit(1)
  return row ?? null
}

export async function startBackgroundInterview(input: {
  clientId: string
  practiceId: string
  userId: string
  practitionerProfileId: string
}): Promise<{ error?: string; interviewId?: string }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const existing = await inProgressInterview(input.clientId, input.practiceId)
  if (existing) return { interviewId: existing.clientBackgroundInterviewId }

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(clientBackgroundInterviews)
        .values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          practitionerProfileId: input.practitionerProfileId,
          status: "in_progress",
          screeningJson: {},
        })
        .returning({ clientBackgroundInterviewId: clientBackgroundInterviews.clientBackgroundInterviewId })
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_background_interview.started",
        entityType: "client_background_interview",
        entityId: created.clientBackgroundInterviewId,
      })
      return { interviewId: created.clientBackgroundInterviewId }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await inProgressInterview(input.clientId, input.practiceId)
      if (raced) return { interviewId: raced.clientBackgroundInterviewId }
    }
    return { error: "Could not start the background interview." }
  }
}

export async function saveInterviewScreening(input: {
  clientId: string
  practiceId: string
  userId: string
  screening: unknown
}): Promise<{ error?: string; screening?: ScreeningAnswers }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const screening = sanitizeScreening(input.screening)
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ clientBackgroundInterviewId: clientBackgroundInterviews.clientBackgroundInterviewId })
        .from(clientBackgroundInterviews)
        .where(
          and(
            eq(clientBackgroundInterviews.clientId, input.clientId),
            eq(clientBackgroundInterviews.practiceId, input.practiceId),
            eq(clientBackgroundInterviews.status, "in_progress")
          )
        )
        .limit(1)
      if (!existing) return { error: "There is no background interview in progress." }
      await tx
        .update(clientBackgroundInterviews)
        .set({ screeningJson: screening, updatedAt: new Date() })
        .where(eq(clientBackgroundInterviews.clientBackgroundInterviewId, existing.clientBackgroundInterviewId))
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_background_interview.screening_updated",
        entityType: "client_background_interview",
        entityId: existing.clientBackgroundInterviewId,
      })
      return { screening }
    })
  } catch {
    return { error: "Could not save the screening answers." }
  }
}

async function verifiedSelfReportId(
  tx: Tx,
  clientId: string,
  practiceId: string,
  selfReportId: string | null
): Promise<string | null> {
  if (!selfReportId) return null
  const [row] = await tx
    .select({ id: assessmentResults.assessmentResultId })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(assessmentInstances.assessmentInstanceId, assessmentResults.assessmentInstanceId)
    )
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentDefinitions.assessmentDefinitionId, assessmentInstances.assessmentDefinitionId)
    )
    .where(
      and(
        eq(assessmentResults.assessmentResultId, selfReportId),
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentInstances.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, BACKGROUND_ASSESSMENT_CODE)
      )
    )
    .limit(1)
  return row?.id ?? null
}

export async function completeBackgroundInterview(input: {
  clientId: string
  practiceId: string
  userId: string
  selfReportId: string | null
}): Promise<{ error?: string }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }

  try {
    return await db.transaction(async (tx) => {
      const [interview] = await tx
        .select()
        .from(clientBackgroundInterviews)
        .where(
          and(
            eq(clientBackgroundInterviews.clientId, input.clientId),
            eq(clientBackgroundInterviews.practiceId, input.practiceId),
            eq(clientBackgroundInterviews.status, "in_progress")
          )
        )
        .limit(1)
      if (!interview) return { error: "There is no background interview in progress." }

      const [clientRow] = await tx
        .select({ dateOfBirth: clients.dateOfBirth })
        .from(clients)
        .where(and(eq(clients.clientId, input.clientId), eq(clients.practiceId, input.practiceId)))
        .limit(1)

      const [background] = await tx
        .select()
        .from(clientBackgrounds)
        .where(
          and(eq(clientBackgrounds.clientId, input.clientId), eq(clientBackgrounds.practiceId, input.practiceId))
        )
        .limit(1)

      const family = await loadFamily(tx, input.clientId, input.practiceId)
      const eventRows = await tx
        .select()
        .from(clientEventRecords)
        .where(
          and(eq(clientEventRecords.clientId, input.clientId), eq(clientEventRecords.practiceId, input.practiceId))
        )
      const dateOfBirth = clientRow?.dateOfBirth ?? null
      const events = eventRows.map((row) => settleEventDates(toEvent(row), dateOfBirth))
      const screening = finalScreeningAnswers(sanitizeScreening(interview.screeningJson), events, dateOfBirth)
      const completedAt = new Date()
      const demographics = background ? demographicsFromStored(background) : emptyDemographics()
      const filled = markUnansweredMedicationAndStressors(
        sanitizeMedication(background?.medicationJson),
        sanitizeStressors(background?.stressorsJson)
      )
      const reasonFilled = markUnansweredReason(sanitizeReasonForAttending(background?.reasonForAttendingJson))
      if (filled.changed || reasonFilled.changed) {
        if (background) {
          await tx
            .update(clientBackgrounds)
            .set({
              medicationJson: filled.medication,
              stressorsJson: filled.stressors,
              reasonForAttendingJson: reasonFilled.reason,
              updatedAt: completedAt,
            })
            .where(
              and(
                eq(clientBackgrounds.clientBackgroundId, background.clientBackgroundId),
                eq(clientBackgrounds.practiceId, input.practiceId)
              )
            )
        } else {
          await tx.insert(clientBackgrounds).values({
            clientId: input.clientId,
            practiceId: input.practiceId,
            medicationJson: filled.medication,
            stressorsJson: filled.stressors,
            reasonForAttendingJson: reasonFilled.reason,
            updatedAt: completedAt,
          })
        }
      }
      const selfReportId = await verifiedSelfReportId(
        tx,
        input.clientId,
        input.practiceId,
        input.selfReportId
      )
      const snapshot = {
        demographics,
        relationshipStatus: toClientRelationshipStatus(background ?? null),
        relationships: family.people,
        partnerships: family.partnerships,
        events,
        screening,
        medication: filled.medication,
        stressors: filled.stressors,
        reason: reasonFilled.reason,
      }

      await tx
        .update(clientBackgroundInterviews)
        .set({
          status: "completed",
          completedAt,
          screeningJson: screening,
          snapshotJson: snapshot,
          selfReportId,
          updatedAt: completedAt,
        })
        .where(eq(clientBackgroundInterviews.clientBackgroundInterviewId, interview.clientBackgroundInterviewId))

      await tx
        .update(clients)
        .set({ backgroundCapturedAt: completedAt, updatedAt: completedAt })
        .where(and(eq(clients.clientId, input.clientId), eq(clients.practiceId, input.practiceId)))

      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_background_interview.completed",
        entityType: "client_background_interview",
        entityId: interview.clientBackgroundInterviewId,
      })
      return {}
    })
  } catch {
    return { error: "Could not complete the background interview." }
  }
}
