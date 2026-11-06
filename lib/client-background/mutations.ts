import "server-only"

import { randomUUID } from "node:crypto"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { auditEvents, assessmentDefinitions, assessmentInstances, assessmentResults, clientBackgroundInterviews, clientBackgrounds, clientEventRecords, clientRelationshipBlocks, clientRelationshipRecords, clients, professionals } from "@/db/schema"
import { BACKGROUND_ASSESSMENT_CODE } from "@/lib/background-questionnaire/types"
import { db } from "@/lib/db"
import { settleEventDates } from "@/lib/client-background/age"
import { personKey } from "@/lib/client-background/condition-groups"
import { isConditionEvent } from "@/lib/client-background/history-links"
import { toClientRelationshipStatus, toEvent, toRelationship } from "@/lib/client-background/map"
import { CONDITION_EVENT_TYPES } from "@/lib/client-background/types"
import {
  finalScreeningAnswers,
  sanitizeScreening,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import {
  demographicsFromStored,
  sanitizeClientRelationshipStatus,
  markUnansweredStressors,
  markUnansweredReason,
  sanitizeEducation,
  sanitizeEvent,
  sanitizeIdentity,
  sanitizeLivingSituation,
  sanitizeOccupation,
  sanitizeReasonForAttending,
  sanitizeRisk,
  sanitizeStressors,
} from "@/lib/client-background/sanitize"
import {
  emptyDemographics,
  type ClientRelationshipStatusValue,
  type EducationFields,
  type EventRecord,
  type IdentityFields,
  type LivingSituationFields,
  type OccupationFields,
  type ReasonForAttending,
  type StressorsRecord,
  type RiskRatings,
} from "@/lib/client-background/types"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type MutationResult<T> = { error?: string } & T

type WriteContext = {
  clientId: string
  practiceId: string
  userId: string
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

      const [biological] = await tx
        .select({ relationshipBlockId: clientRelationshipBlocks.relationshipBlockId })
        .from(clientRelationshipBlocks)
        .where(
          and(
            eq(clientRelationshipBlocks.clientId, input.clientId),
            eq(clientRelationshipBlocks.practiceId, input.practiceId),
            eq(clientRelationshipBlocks.kind, "biological_parents")
          )
        )
        .limit(1)
      let biologicalId = biological?.relationshipBlockId
      if (!biologicalId) {
        const [createdBlock] = await tx
          .insert(clientRelationshipBlocks)
          .values({
            clientId: input.clientId,
            practiceId: input.practiceId,
            kind: "biological_parents",
          })
          .returning()
        biologicalId = createdBlock.relationshipBlockId
        await writeAudit(tx, {
          practiceId: input.practiceId,
          userId: input.userId,
          clientId: input.clientId,
          eventType: "client_relationship_block.created",
          entityType: "client_relationship_block",
          entityId: biologicalId,
        })
      }
      for (const person of [mother, father]) {
        if (person.relationshipBlockId) continue
        await tx
          .update(clientRelationshipRecords)
          .set({
            relationshipBlockId: biologicalId,
            blockRole: "parent",
            blockRoleType: person.relationshipToClient,
            updatedAt: new Date(),
          })
          .where(eq(clientRelationshipRecords.relationshipRecordId, person.relationshipRecordId))
      }
    })
    return {}
  } catch {
    return { error: "Could not prepare family of origin." }
  }
}

function orientationColumns(identity: IdentityFields) {
  return {
    sexualOrientation: identity.sexualOrientation || null,
    sexualOrientationOther: identity.sexualOrientation === "another" ? identity.sexualOrientationOther || null : null,
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
    stressorsJson: StressorsRecord
    reasonForAttendingJson: ReasonForAttending
    sexualOrientation: string | null
    sexualOrientationOther: string | null
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
      ...orientationColumns(identity),
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
      ...orientationColumns(identity),
    })
    return {
      ...result,
      demographics: { identity, livingSituation, education, occupation },
    }
  } catch {
    return { error: "Could not save demographics." }
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
  return {
    people: relationshipRows.map(toRelationship),
  }
}

async function withConditionGroup(tx: Tx, clientId: string, practiceId: string, event: EventRecord): Promise<EventRecord> {
  if (!isConditionEvent(event.eventType)) return { ...event, conditionGroupId: null }
  const incoming = event.conditionGroupId?.trim() ?? ""
  const joining = incoming.length > 0 && !incoming.startsWith("title:")
  const conditionGroupId = joining ? incoming : randomUUID()
  if (joining) {
    const rows = await tx
      .select()
      .from(clientEventRecords)
      .where(
        and(
          eq(clientEventRecords.clientId, clientId),
          eq(clientEventRecords.practiceId, practiceId),
          inArray(clientEventRecords.eventType, [...CONDITION_EVENT_TYPES]),
          isNull(clientEventRecords.conditionGroupId)
        )
      )
    const title = event.title.trim().toLowerCase()
    for (const row of rows) {
      const mapped = toEvent(row)
      if (mapped.eventRecordId === event.eventRecordId) continue
      if (mapped.eventType !== event.eventType || personKey(mapped) !== personKey(event)) continue
      if (mapped.title.trim().toLowerCase() !== title) continue
      await tx
        .update(clientEventRecords)
        .set({ conditionGroupId, updatedAt: new Date() })
        .where(eq(clientEventRecords.eventRecordId, mapped.eventRecordId))
    }
  }
  return { ...event, conditionGroupId }
}

async function conditionLinkError(
  tx: Tx,
  clientId: string,
  practiceId: string,
  event: EventRecord
): Promise<string | null> {
  if (!event.conditionEventId) return null
  if (event.eventRecordId && event.conditionEventId === event.eventRecordId) {
    return "A treatment cannot be linked to itself."
  }
  const [row] = await tx
    .select({ eventType: clientEventRecords.eventType })
    .from(clientEventRecords)
    .where(
      and(
        eq(clientEventRecords.eventRecordId, event.conditionEventId),
        eq(clientEventRecords.clientId, clientId),
        eq(clientEventRecords.practiceId, practiceId)
      )
    )
    .limit(1)
  if (!row || !(CONDITION_EVENT_TYPES as readonly string[]).includes(row.eventType)) {
    return "Choose a condition on this client."
  }
  return null
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
    about: event.about,
    aboutOther: event.aboutOther || null,
    relationshipRecordId: event.relationshipRecordId,
    conditionEventId: event.conditionEventId,
    conditionGroupId: event.conditionGroupId,
    admissionType: event.admissionType || null,
    facility: event.facility || null,
    admissionLength: event.admissionLength || null,
    prescriberProfessionalId: event.prescriberProfessionalId,
    prescriberName: event.prescriberName || null,
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
      const linkError = await conditionLinkError(tx, input.clientId, input.practiceId, parsed)
      if (linkError) return { error: linkError }
      const grouped = await withConditionGroup(tx, input.clientId, input.practiceId, parsed)
      const displayOrder = await nextEventOrder(tx, input.clientId, input.practiceId, parsed.eventType)
      const draft = { ...grouped, eventRecordId: "", displayOrder }
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
      const linkError = await conditionLinkError(tx, input.clientId, input.practiceId, draft)
      if (linkError) return { error: linkError }
      const grouped = await withConditionGroup(tx, input.clientId, input.practiceId, draft)

      if (grouped.relationshipRecordId) {
        const linked = await ownedRelationship(tx, grouped.relationshipRecordId, input.clientId, input.practiceId)
        if (!linked) return { error: "That family member was not found on this client." }
      }

      const [updated] = await tx
        .update(clientEventRecords)
        .set(eventColumns({ ...grouped, displayOrder: existing.displayOrder }))
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
      const filled = markUnansweredStressors(sanitizeStressors(background?.stressorsJson))
      const reasonFilled = markUnansweredReason(sanitizeReasonForAttending(background?.reasonForAttendingJson))
      if (filled.changed || reasonFilled.changed) {
        if (background) {
          await tx
            .update(clientBackgrounds)
            .set({
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
        events,
        screening,
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
