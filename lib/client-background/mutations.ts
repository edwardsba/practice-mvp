import "server-only"

import { randomUUID } from "node:crypto"

import { and, desc, eq, inArray, isNull } from "drizzle-orm"

import {
  auditEvents,
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
  clientBackgroundInterviews,
  clientBackgrounds,
  clientEmergencyContacts,
  clientEventRecords,
  clientHistoryIssues,
  clientMedicalContacts,
  clientRelationshipBlocks,
  clientRelationshipRecords,
  clients,
} from "@/db/schema"
import { BACKGROUND_ASSESSMENT_CODE } from "@/lib/background-questionnaire/types"
import { db } from "@/lib/db"
import { settleEventDates } from "@/lib/client-background/age"
import { personKey } from "@/lib/client-background/condition-groups"
import { treatmentAnswerAfterChange, treatmentsForIssue } from "@/lib/client-background/history-issues"
import { isConditionEvent, isTreatmentEvent } from "@/lib/client-background/history-links"
import { toClientRelationshipStatus, toEvent, toHistoryIssue, toRelationship } from "@/lib/client-background/map"
import {
  CONDITION_EVENT_TYPES,
  type ConditionEventType,
  type HistoryAbout,
  type HistoryIssue,
  type TreatmentAnswer,
} from "@/lib/client-background/types"
import { sanitizeHistoryIssue } from "@/lib/client-background/history-issues"
import {
  blockAnswersFromInterview,
  confirmAllAnswers,
  emptyInterviewAnswers,
  isPerRecordContactKey,
  mergeScreeningMirror,
  perRecordContactId,
  prefillAnswersForReview,
  sanitizeInterviewAnswers,
  setItemAnswer,
  S4_EC_PREFIX,
  S4_MC_PREFIX,
  validateItemAnswer,
  type InterviewAnswerValue,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"
import {
  finalScreeningAnswers,
  sanitizeScreening,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import {
  demographicsFromStored,
  sanitizeClientRelationshipStatus,
  markUnansweredStressors,
  sanitizeEducation,
  sanitizeEvent,
  sanitizeIdentity,
  sanitizeLivingSituation,
  sanitizeOccupation,
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

async function ensureHistoryIssue(
  tx: Tx,
  clientId: string,
  practiceId: string,
  event: EventRecord,
  conditionGroupId: string
): Promise<void> {
  if (!isConditionEvent(event.eventType)) return
  const [existing] = await tx
    .select({ issueId: clientHistoryIssues.issueId })
    .from(clientHistoryIssues)
    .where(eq(clientHistoryIssues.issueId, conditionGroupId))
    .limit(1)
  const title = event.title.trim() || event.eventType
  const aboutOther =
    event.about === "significant_other" && !event.relationshipRecordId ? event.aboutOther.trim() || null : null
  if (existing) {
    await tx
      .update(clientHistoryIssues)
      .set({
        title,
        about: event.about,
        relationshipRecordId: event.relationshipRecordId,
        aboutOther,
        category: event.eventType,
        updatedAt: new Date(),
      })
      .where(eq(clientHistoryIssues.issueId, conditionGroupId))
    return
  }
  await tx.insert(clientHistoryIssues).values({
    issueId: conditionGroupId,
    clientId,
    practiceId,
    category: event.eventType,
    about: event.about,
    relationshipRecordId: event.relationshipRecordId,
    aboutOther,
    title,
    treatmentAnswer: null,
    displayOrder: 0,
  })
}

async function withConditionGroup(tx: Tx, clientId: string, practiceId: string, event: EventRecord): Promise<EventRecord> {
  if (isTreatmentEvent(event.eventType) || event.eventType === "other_event") {
    const incoming = event.conditionGroupId?.trim() ?? ""
    // Nested under a single event (self-harm / traumatic / significant).
    if (event.parentEventId) {
      return {
        ...event,
        conditionGroupId: incoming && !incoming.startsWith("title:") ? incoming : null,
      }
    }
    if (incoming && !incoming.startsWith("title:")) {
      return { ...event, conditionGroupId: incoming }
    }
    return { ...event, conditionGroupId: null }
  }
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
  await ensureHistoryIssue(tx, clientId, practiceId, event, conditionGroupId)
  return { ...event, conditionGroupId }
}

async function conditionLinkError(
  tx: Tx,
  clientId: string,
  practiceId: string,
  event: EventRecord
): Promise<string | null> {
  if (!isTreatmentEvent(event.eventType)) return null
  const issueId = event.conditionGroupId?.trim() ?? ""
  if (!issueId || issueId.startsWith("title:")) return null
  const [row] = await tx
    .select({ issueId: clientHistoryIssues.issueId, category: clientHistoryIssues.category })
    .from(clientHistoryIssues)
    .where(
      and(
        eq(clientHistoryIssues.issueId, issueId),
        eq(clientHistoryIssues.clientId, clientId),
        eq(clientHistoryIssues.practiceId, practiceId)
      )
    )
    .limit(1)
  if (!row || !(CONDITION_EVENT_TYPES as readonly string[]).includes(row.category)) {
    return "Choose an issue on this client."
  }
  return null
}

async function syncIssueTreatmentAnswer(
  tx: Tx,
  clientId: string,
  practiceId: string,
  issueId: string | null | undefined
) {
  if (!issueId || issueId.startsWith("title:")) return
  const [issue] = await tx
    .select()
    .from(clientHistoryIssues)
    .where(
      and(
        eq(clientHistoryIssues.issueId, issueId),
        eq(clientHistoryIssues.clientId, clientId),
        eq(clientHistoryIssues.practiceId, practiceId)
      )
    )
    .limit(1)
  if (!issue) return
  const eventRows = await tx
    .select()
    .from(clientEventRecords)
    .where(and(eq(clientEventRecords.clientId, clientId), eq(clientEventRecords.practiceId, practiceId)))
  const events = eventRows.map((row) => toEvent(row))
  const count = treatmentsForIssue(events, issueId).length
  const current = (issue.treatmentAnswer === "yes" || issue.treatmentAnswer === "none" || issue.treatmentAnswer === "not_asked"
    ? issue.treatmentAnswer
    : "") as TreatmentAnswer | ""
  const next = treatmentAnswerAfterChange(current, count)
  if (next === current) return
  await tx
    .update(clientHistoryIssues)
    .set({ treatmentAnswer: next, updatedAt: new Date() })
    .where(eq(clientHistoryIssues.issueId, issueId))
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
    about: event.about,
    aboutOther: event.aboutOther || null,
    relationshipRecordId: event.relationshipRecordId,
    conditionGroupId: event.conditionGroupId,
    parentEventId: event.parentEventId,
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
      if (isTreatmentEvent(draft.eventType)) {
        await syncIssueTreatmentAnswer(tx, input.clientId, input.practiceId, draft.conditionGroupId)
      }
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

      const previousGroupId = existing.conditionGroupId
      const [updated] = await tx
        .update(clientEventRecords)
        .set(eventColumns({ ...grouped, displayOrder: existing.displayOrder }))
        .where(eq(clientEventRecords.eventRecordId, existing.eventRecordId))
        .returning()

      if (isTreatmentEvent(grouped.eventType) || isTreatmentEvent(existing.eventType as EventRecord["eventType"])) {
        await syncIssueTreatmentAnswer(tx, input.clientId, input.practiceId, previousGroupId)
        await syncIssueTreatmentAnswer(tx, input.clientId, input.practiceId, grouped.conditionGroupId)
      }

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
      await tx
        .update(clientEventRecords)
        .set({ parentEventId: null, updatedAt: new Date() })
        .where(eq(clientEventRecords.parentEventId, existing.eventRecordId))
      await tx.delete(clientEventRecords).where(eq(clientEventRecords.eventRecordId, existing.eventRecordId))
      if (isTreatmentEvent(existing.eventType as EventRecord["eventType"])) {
        await syncIssueTreatmentAnswer(tx, input.clientId, input.practiceId, existing.conditionGroupId)
      }
      return {}
    })
  } catch {
    return { error: "Could not remove this entry." }
  }
}

export async function createHistoryIssue(input: {
  clientId: string
  practiceId: string
  userId: string
  issue: unknown
  /** Optional first episode dates when creating a New issue. */
  firstEpisode?: {
    startPrecision: EventRecord["startPrecision"]
    startValue: string
    endPrecision: EventRecord["endPrecision"]
    endValue: string
    endOngoing: boolean
    resolvedOrOngoing: EventRecord["resolvedOrOngoing"]
  } | null
}): Promise<MutationResult<{ issue?: HistoryIssue; event?: EventRecord }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const parsed = sanitizeHistoryIssue(input.issue, randomUUID())
  if (!(CONDITION_EVENT_TYPES as readonly string[]).includes(parsed.category)) {
    return { error: "Choose a category." }
  }
  if (!parsed.title.trim()) return { error: "Enter an issue name." }
  if (parsed.about === "significant_other" && !parsed.relationshipRecordId && !parsed.aboutOther.trim()) {
    return { error: "Choose who this issue is about." }
  }
  const treatmentAnswer =
    parsed.treatmentAnswer === "yes" || parsed.treatmentAnswer === "none" || parsed.treatmentAnswer === "not_asked"
      ? parsed.treatmentAnswer
      : null
  try {
    return await db.transaction(async (tx) => {
      const issueId = parsed.issueId || randomUUID()
      const [created] = await tx
        .insert(clientHistoryIssues)
        .values({
          issueId,
          clientId: input.clientId,
          practiceId: input.practiceId,
          category: parsed.category,
          about: parsed.about,
          relationshipRecordId: parsed.relationshipRecordId,
          aboutOther:
            parsed.about === "significant_other" && !parsed.relationshipRecordId
              ? parsed.aboutOther.trim() || null
              : null,
          title: parsed.title.trim(),
          treatmentAnswer,
          displayOrder: parsed.displayOrder,
        })
        .returning()
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_history_issue.created",
        entityType: "client_history_issue",
        entityId: created.issueId,
      })
      let event: EventRecord | undefined
      const first = input.firstEpisode
      if (first && (first.startValue.trim() || first.endValue.trim() || first.endOngoing || first.resolvedOrOngoing)) {
        const displayOrder = await nextEventOrder(tx, input.clientId, input.practiceId, parsed.category)
        const [createdEvent] = await tx
          .insert(clientEventRecords)
          .values({
            clientId: input.clientId,
            practiceId: input.practiceId,
            ...eventColumns({
              eventRecordId: "",
              eventType: parsed.category,
              title: parsed.title.trim(),
              description: "",
              startPrecision: first.startPrecision,
              startValue: first.startValue,
              endPrecision: first.endPrecision,
              endValue: first.endValue,
              endOngoing: first.endOngoing || first.resolvedOrOngoing === "ongoing",
              resolvedOrOngoing: first.resolvedOrOngoing,
              about: parsed.about,
              aboutOther: parsed.aboutOther,
              relationshipRecordId: parsed.relationshipRecordId,
              conditionGroupId: created.issueId,
              parentEventId: null,
              admissionType: "",
              facility: "",
              admissionLength: "",
              prescriberProfessionalId: null,
              prescriberName: "",
              selfHarmType: "",
              substanceStatus: "",
              abstinentSincePrecision: "",
              abstinentSinceValue: "",
              displayOrder,
            }),
          })
          .returning()
        event = toEvent(createdEvent)
        await writeAudit(tx, {
          practiceId: input.practiceId,
          userId: input.userId,
          clientId: input.clientId,
          eventType: "client_event.created",
          entityType: "client_event",
          entityId: createdEvent.eventRecordId,
        })
      }
      return { issue: toHistoryIssue(created), event }
    })
  } catch {
    return { error: "Could not add this issue." }
  }
}

export async function updateHistoryIssue(input: {
  clientId: string
  practiceId: string
  userId: string
  issue: unknown
}): Promise<MutationResult<{ issue?: HistoryIssue }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const parsed = sanitizeHistoryIssue(input.issue)
  if (!parsed.issueId) return { error: "That issue was not found." }
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(clientHistoryIssues)
        .where(
          and(
            eq(clientHistoryIssues.issueId, parsed.issueId),
            eq(clientHistoryIssues.clientId, input.clientId),
            eq(clientHistoryIssues.practiceId, input.practiceId)
          )
        )
        .limit(1)
      if (!existing) return { error: "That issue was not found." }
      const treatmentAnswer =
        parsed.treatmentAnswer === "yes" || parsed.treatmentAnswer === "none" || parsed.treatmentAnswer === "not_asked"
          ? parsed.treatmentAnswer
          : existing.treatmentAnswer
      const [updated] = await tx
        .update(clientHistoryIssues)
        .set({
          title: parsed.title.trim() || existing.title,
          about: parsed.about,
          relationshipRecordId: parsed.relationshipRecordId,
          aboutOther:
            parsed.about === "significant_other" && !parsed.relationshipRecordId
              ? parsed.aboutOther.trim() || null
              : null,
          category: (CONDITION_EVENT_TYPES as readonly string[]).includes(parsed.category)
            ? parsed.category
            : (existing.category as ConditionEventType),
          treatmentAnswer,
          updatedAt: new Date(),
        })
        .where(eq(clientHistoryIssues.issueId, existing.issueId))
        .returning()
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_history_issue.updated",
        entityType: "client_history_issue",
        entityId: updated.issueId,
      })
      return { issue: toHistoryIssue(updated) }
    })
  } catch {
    return { error: "Could not save this issue." }
  }
}

export async function updateHistoryIssueTreatmentAnswer(input: {
  clientId: string
  practiceId: string
  userId: string
  issueId: string
  treatmentAnswer: TreatmentAnswer | ""
}): Promise<MutationResult<{ issue?: HistoryIssue }>> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const answer =
    input.treatmentAnswer === "yes" || input.treatmentAnswer === "none" || input.treatmentAnswer === "not_asked"
      ? input.treatmentAnswer
      : null
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(clientHistoryIssues)
        .where(
          and(
            eq(clientHistoryIssues.issueId, input.issueId),
            eq(clientHistoryIssues.clientId, input.clientId),
            eq(clientHistoryIssues.practiceId, input.practiceId)
          )
        )
        .limit(1)
      if (!existing) return { error: "That issue was not found." }
      const eventRows = await tx
        .select()
        .from(clientEventRecords)
        .where(and(eq(clientEventRecords.clientId, input.clientId), eq(clientEventRecords.practiceId, input.practiceId)))
      const events = eventRows.map((row) => toEvent(row))
      if (treatmentsForIssue(events, input.issueId).length > 0 && answer !== "yes") {
        return { error: "Remove treatments before changing this answer." }
      }
      const [updated] = await tx
        .update(clientHistoryIssues)
        .set({ treatmentAnswer: answer, updatedAt: new Date() })
        .where(eq(clientHistoryIssues.issueId, existing.issueId))
        .returning()
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_history_issue.updated",
        entityType: "client_history_issue",
        entityId: updated.issueId,
      })
      return { issue: toHistoryIssue(updated) }
    })
  } catch {
    return { error: "Could not save the treatment answer." }
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

async function latestCompletedAnswers(
  tx: Tx,
  clientId: string,
  practiceId: string
): Promise<InterviewAnswersJson> {
  const [row] = await tx
    .select({ answersJson: clientBackgroundInterviews.answersJson })
    .from(clientBackgroundInterviews)
    .where(
      and(
        eq(clientBackgroundInterviews.clientId, clientId),
        eq(clientBackgroundInterviews.practiceId, practiceId),
        eq(clientBackgroundInterviews.status, "completed")
      )
    )
    .orderBy(desc(clientBackgroundInterviews.completedAt))
    .limit(1)
  if (!row) return emptyInterviewAnswers()
  return prefillAnswersForReview(sanitizeInterviewAnswers(row.answersJson))
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
      const answersJson = await latestCompletedAnswers(tx, input.clientId, input.practiceId)
      const [created] = await tx
        .insert(clientBackgroundInterviews)
        .values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          practitionerProfileId: input.practitionerProfileId,
          status: "in_progress",
          screeningJson: {},
          answersJson,
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

async function writeBlockAnswerMirrors(
  clientId: string,
  practiceId: string,
  answers: InterviewAnswersJson
) {
  const mirrors = blockAnswersFromInterview(answers)
  if (Object.keys(mirrors).length === 0) return
  const [existing] = await db
    .select({
      id: clientBackgrounds.clientBackgroundId,
      practiceId: clientBackgrounds.practiceId,
      previousRelationships: clientBackgrounds.previousRelationships,
      motherOtherRelationships: clientBackgrounds.motherOtherRelationships,
      fatherOtherRelationships: clientBackgrounds.fatherOtherRelationships,
      caregiverArrangements: clientBackgrounds.caregiverArrangements,
    })
    .from(clientBackgrounds)
    .where(and(eq(clientBackgrounds.clientId, clientId), eq(clientBackgrounds.practiceId, practiceId)))
    .limit(1)

  const next = {
    previousRelationships: existing?.previousRelationships ?? null,
    motherOtherRelationships: existing?.motherOtherRelationships ?? null,
    fatherOtherRelationships: existing?.fatherOtherRelationships ?? null,
    caregiverArrangements: existing?.caregiverArrangements ?? null,
    updatedAt: new Date(),
  }
  if (mirrors.previousRelationships) next.previousRelationships = mirrors.previousRelationships
  if (mirrors.motherOtherRelationships) next.motherOtherRelationships = mirrors.motherOtherRelationships
  if (mirrors.fatherOtherRelationships) next.fatherOtherRelationships = mirrors.fatherOtherRelationships
  if (mirrors.caregiverArrangements) next.caregiverArrangements = mirrors.caregiverArrangements

  if (!existing) {
    await db.insert(clientBackgrounds).values({
      clientId,
      practiceId,
      ...next,
    })
    return
  }
  await db.update(clientBackgrounds).set(next).where(eq(clientBackgrounds.clientBackgroundId, existing.id))
}

async function assertPerRecordContactBelongsToClient(input: {
  clientId: string
  practiceId: string
  itemKey: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPerRecordContactKey(input.itemKey)) return { ok: true }
  const id = perRecordContactId(input.itemKey)
  if (!id) return { ok: false, error: "Unknown interview item." }
  if (input.itemKey.startsWith(S4_EC_PREFIX)) {
    const [row] = await db
      .select({ id: clientEmergencyContacts.contactId })
      .from(clientEmergencyContacts)
      .where(
        and(
          eq(clientEmergencyContacts.contactId, id),
          eq(clientEmergencyContacts.clientId, input.clientId),
          eq(clientEmergencyContacts.practiceId, input.practiceId)
        )
      )
      .limit(1)
    if (!row) return { ok: false, error: "That emergency contact was not found for this client." }
    return { ok: true }
  }
  if (input.itemKey.startsWith(S4_MC_PREFIX)) {
    const [row] = await db
      .select({ id: clientMedicalContacts.medicalContactId })
      .from(clientMedicalContacts)
      .where(
        and(
          eq(clientMedicalContacts.medicalContactId, id),
          eq(clientMedicalContacts.clientId, input.clientId),
          eq(clientMedicalContacts.practiceId, input.practiceId)
        )
      )
      .limit(1)
    if (!row) return { ok: false, error: "That medical contact was not found for this client." }
    return { ok: true }
  }
  return { ok: false, error: "Unknown interview item." }
}

export async function saveInterviewItemAnswer(input: {
  clientId: string
  practiceId: string
  userId: string
  itemKey: string
  value: InterviewAnswerValue
}): Promise<{ error?: string; answers?: InterviewAnswersJson; screening?: ScreeningAnswers }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const validated = validateItemAnswer(input.itemKey, input.value)
  if (!validated.ok) return { error: validated.error }
  const ownership = await assertPerRecordContactBelongsToClient({
    clientId: input.clientId,
    practiceId: input.practiceId,
    itemKey: input.itemKey,
  })
  if (!ownership.ok) return { error: ownership.error }
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          clientBackgroundInterviewId: clientBackgroundInterviews.clientBackgroundInterviewId,
          answersJson: clientBackgroundInterviews.answersJson,
          screeningJson: clientBackgroundInterviews.screeningJson,
        })
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
      const answers = setItemAnswer(
        sanitizeInterviewAnswers(existing.answersJson),
        input.itemKey,
        validated.value
      )
      const screening = mergeScreeningMirror(sanitizeScreening(existing.screeningJson), answers)
      await tx
        .update(clientBackgroundInterviews)
        .set({
          answersJson: answers,
          screeningJson: screening,
          updatedAt: new Date(),
        })
        .where(eq(clientBackgroundInterviews.clientBackgroundInterviewId, existing.clientBackgroundInterviewId))
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_background_interview.answers_updated",
        entityType: "client_background_interview",
        entityId: existing.clientBackgroundInterviewId,
      })
      return { answers, screening }
    }).then(async (result) => {
      if (result.answers) {
        await writeBlockAnswerMirrors(input.clientId, input.practiceId, result.answers)
      }
      return result
    })
  } catch {
    return { error: "Could not save the interview answer." }
  }
}

export async function saveInterviewAnswersBulk(input: {
  clientId: string
  practiceId: string
  userId: string
  answers: InterviewAnswersJson
}): Promise<{ error?: string; answers?: InterviewAnswersJson; screening?: ScreeningAnswers }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const answers = sanitizeInterviewAnswers(input.answers)
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          clientBackgroundInterviewId: clientBackgroundInterviews.clientBackgroundInterviewId,
          screeningJson: clientBackgroundInterviews.screeningJson,
        })
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
      const screening = mergeScreeningMirror(sanitizeScreening(existing.screeningJson), answers)
      await tx
        .update(clientBackgroundInterviews)
        .set({
          answersJson: answers,
          screeningJson: screening,
          updatedAt: new Date(),
        })
        .where(eq(clientBackgroundInterviews.clientBackgroundInterviewId, existing.clientBackgroundInterviewId))
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_background_interview.answers_updated",
        entityType: "client_background_interview",
        entityId: existing.clientBackgroundInterviewId,
      })
      return { answers, screening }
    }).then(async (result) => {
      if (result.answers) {
        await writeBlockAnswerMirrors(input.clientId, input.practiceId, result.answers)
      }
      return result
    })
  } catch {
    return { error: "Could not save the interview answers." }
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
  /** When true, mark every answers_json item confirmed before completing. */
  confirmAllItems?: boolean
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
      let answers = sanitizeInterviewAnswers(interview.answersJson)
      if (input.confirmAllItems) answers = confirmAllAnswers(answers)
      const screening = finalScreeningAnswers(
        mergeScreeningMirror(sanitizeScreening(interview.screeningJson), answers),
        events,
        dateOfBirth
      )
      const completedAt = new Date()
      const demographics = background ? demographicsFromStored(background) : emptyDemographics()
      const filled = markUnansweredStressors(sanitizeStressors(background?.stressorsJson))
      if (filled.changed) {
        if (background) {
          await tx
            .update(clientBackgrounds)
            .set({
              stressorsJson: filled.stressors,
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
        answers,
      }

      await tx
        .update(clientBackgroundInterviews)
        .set({
          status: "completed",
          completedAt,
          screeningJson: screening,
          answersJson: answers,
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
