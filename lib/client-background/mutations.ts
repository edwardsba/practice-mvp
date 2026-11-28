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
import {
  backgroundAnswersToClientBackground,
  type ClientBackgroundSuggestions,
} from "@/lib/background-questionnaire/to-client-background"
import { BACKGROUND_ASSESSMENT_CODE } from "@/lib/background-questionnaire/types"
import { db } from "@/lib/db"
import { settleEventDates } from "@/lib/client-background/age"
import { personKey } from "@/lib/client-background/condition-groups"
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
  confirmSectionAnswers,
  emptyInterviewAnswers,
  isPerRecordContactKey,
  mergeScreeningMirror,
  perRecordContactId,
  prefillAnswersForReview,
  sanitizeInterviewAnswers,
  sectionsNotConfirmed,
  setItemAnswer,
  S4_EC_PREFIX,
  S4_MC_PREFIX,
  validateItemAnswer,
  type InterviewAnswerValue,
  type InterviewAnswersJson,
  type InterviewItemDef,
} from "@/lib/client-background/interview-answers"
import {
  acceptClientChangesAndConfirm,
  decideClientField,
  SELF_REPORT_CHANGED_ERROR,
} from "@/lib/client-background/interview-client-decisions"
import type { ClientFieldSection } from "@/lib/client-background/interview-client-fields"
import {
  finalScreeningAnswers,
  sanitizeScreening,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import { loadLatestBackgroundSelfReport } from "@/lib/client-background/load"
import {
  demographicsFromStored,
  sanitizeClientRelationshipStatus,
  sanitizeEducation,
  sanitizeEvent,
  sanitizeIdentity,
  sanitizeLivingSituation,
  sanitizeOccupation,
  sanitizeStressors,
} from "@/lib/client-background/sanitize"
import {
  emptyDemographics,
  type ClientRelationshipStatusValue,
  type Demographics,
  type EducationFields,
  type EventRecord,
  type IdentityFields,
  type LivingSituationFields,
  type OccupationFields,
  type StressorsRecord,
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

type BackgroundColumnPatch = Partial<{
  identityJson: IdentityFields
  livingSituationJson: LivingSituationFields
  educationJson: EducationFields
  occupationJson: OccupationFields
  stressorsJson: StressorsRecord
}>

async function upsertBackgroundColumnInTx(
  tx: Tx,
  clientId: string,
  practiceId: string,
  userId: string,
  patch: BackgroundColumnPatch
) {
  const now = new Date()
  let entityId = ""
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
}

async function upsertBackgroundColumn(
  clientId: string,
  practiceId: string,
  userId: string,
  patch: BackgroundColumnPatch
) {
  const client = await assertClient(clientId, practiceId)
  if (!client) return { error: "Client was not found." }

  await db.transaction((tx) => upsertBackgroundColumnInTx(tx, clientId, practiceId, userId, patch))

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

/** No-op: treatment is an event under an issue; treatment_answer is no longer synced. */
async function syncIssueTreatmentAnswer(
  _tx: Tx,
  _clientId: string,
  _practiceId: string,
  _issueId: string | null | undefined
) {
  return
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
          treatmentAnswer: null,
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
          treatmentAnswer: existing.treatmentAnswer,
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

/** No-op write: treatment is an event; treatment_answer is no longer set from the UI. */
export async function updateHistoryIssueTreatmentAnswer(input: {
  clientId: string
  practiceId: string
  userId: string
  issueId: string
  treatmentAnswer: TreatmentAnswer | ""
}): Promise<MutationResult<{ issue?: HistoryIssue }>> {
  void input.userId
  void input.treatmentAnswer
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  try {
    const [existing] = await db
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
    return { issue: toHistoryIssue(existing) }
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
  const supplied = sanitizeInterviewAnswers(input.answers)
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
      // Section sign-off only comes from confirmInterviewSection, which checks the questions.
      const answers: InterviewAnswersJson = {
        ...supplied,
        sections: sanitizeInterviewAnswers(existing.answersJson).sections,
      }
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

/**
 * Extra items arrive from the browser. Only section 4's per-record contact rows may be
 * added, always as details items, and only for this client's own contacts.
 */
async function ownedSection4ExtraItems(input: {
  clientId: string
  practiceId: string
  sectionNumber: number
  extraItems: unknown
}): Promise<InterviewItemDef[]> {
  if (input.sectionNumber !== 4 || !Array.isArray(input.extraItems)) return []
  const keys = new Set<string>()
  for (const item of input.extraItems) {
    const key = item && typeof item === "object" ? (item as { key?: unknown }).key : null
    if (typeof key === "string" && isPerRecordContactKey(key) && perRecordContactId(key)) keys.add(key)
  }
  const owned: InterviewItemDef[] = []
  for (const key of keys) {
    const ownership = await assertPerRecordContactBelongsToClient({
      clientId: input.clientId,
      practiceId: input.practiceId,
      itemKey: key,
    })
    if (ownership.ok) owned.push({ key, label: key, kind: "cna" })
  }
  return owned
}

export async function confirmInterviewSection(input: {
  clientId: string
  practiceId: string
  userId: string
  sectionNumber: number
  detailHasValue: Record<string, boolean>
  extraItems?: InterviewItemDef[]
}): Promise<{ error?: string; answers?: InterviewAnswersJson; screening?: ScreeningAnswers }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const extraItems = await ownedSection4ExtraItems({
    clientId: input.clientId,
    practiceId: input.practiceId,
    sectionNumber: input.sectionNumber,
    extraItems: input.extraItems,
  })
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
      const current = sanitizeInterviewAnswers(existing.answersJson)
      const confirmed = confirmSectionAnswers(
        current,
        input.sectionNumber,
        input.detailHasValue,
        extraItems,
        new Date().toISOString()
      )
      if (!confirmed.ok) return { error: confirmed.error }
      const screening = mergeScreeningMirror(sanitizeScreening(existing.screeningJson), confirmed.answers)
      await tx
        .update(clientBackgroundInterviews)
        .set({
          answersJson: confirmed.answers,
          screeningJson: screening,
          updatedAt: new Date(),
        })
        .where(eq(clientBackgroundInterviews.clientBackgroundInterviewId, existing.clientBackgroundInterviewId))
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType: "client_background_interview.section_confirmed",
        entityType: "client_background_interview",
        entityId: existing.clientBackgroundInterviewId,
      })
      return { answers: confirmed.answers, screening }
    }).then(async (result) => {
      if (result.answers) {
        await writeBlockAnswerMirrors(input.clientId, input.practiceId, result.answers)
      }
      return result
    })
  } catch {
    return { error: "Could not confirm the interview section." }
  }
}

async function inProgressInterviewInTx(tx: Tx, clientId: string, practiceId: string) {
  const [row] = await tx
    .select({
      clientBackgroundInterviewId: clientBackgroundInterviews.clientBackgroundInterviewId,
      answersJson: clientBackgroundInterviews.answersJson,
      screeningJson: clientBackgroundInterviews.screeningJson,
    })
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

async function demographicsInTx(tx: Tx, clientId: string, practiceId: string): Promise<Demographics> {
  const [background] = await tx
    .select()
    .from(clientBackgrounds)
    .where(and(eq(clientBackgrounds.clientId, clientId), eq(clientBackgrounds.practiceId, practiceId)))
    .limit(1)
  return background ? demographicsFromStored(background) : emptyDemographics()
}

/** Suggestions from the client's latest self-report, only when it is the one the page showed. */
async function shownSelfReportSuggestions(
  clientId: string,
  practiceId: string,
  selfReportId: unknown
): Promise<ClientBackgroundSuggestions | null> {
  if (typeof selfReportId !== "string" || !selfReportId) return null
  const selfReport = await loadLatestBackgroundSelfReport(clientId, practiceId)
  if (!selfReport || selfReport.resultId !== selfReportId) return null
  return backgroundAnswersToClientBackground(selfReport.answers)
}

function demographicsPatch(demographics: Demographics, sections: readonly ClientFieldSection[]) {
  const patch: BackgroundColumnPatch = {}
  const changed: Partial<Demographics> = {}
  if (sections.includes("identity")) {
    patch.identityJson = changed.identity = demographics.identity
  }
  if (sections.includes("education")) {
    patch.educationJson = changed.education = demographics.education
  }
  if (sections.includes("occupation")) {
    patch.occupationJson = changed.occupation = demographics.occupation
  }
  if (sections.includes("livingSituation")) {
    patch.livingSituationJson = changed.livingSituation = demographics.livingSituation
  }
  return { patch, changed }
}

/**
 * Interview sections 3 and 7: Use client's (copy the stored self-report answer onto the file) or
 * Keep (leave the file) for one field, and record the choice on the interview.
 */
export async function decideInterviewClientAnswer(input: {
  clientId: string
  practiceId: string
  userId: string
  fieldKey: unknown
  choice: unknown
  selfReportId: unknown
}): Promise<{ error?: string; answers?: InterviewAnswersJson; demographics?: Partial<Demographics> }> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const suggestions = await shownSelfReportSuggestions(input.clientId, input.practiceId, input.selfReportId)
  if (!suggestions) return { error: SELF_REPORT_CHANGED_ERROR }
  try {
    return await db.transaction(async (tx) => {
      const interview = await inProgressInterviewInTx(tx, input.clientId, input.practiceId)
      if (!interview) return { error: "There is no background interview in progress." }
      const decided = decideClientField({
        answers: sanitizeInterviewAnswers(interview.answersJson),
        demographics: await demographicsInTx(tx, input.clientId, input.practiceId),
        suggestions,
        fieldKey: input.fieldKey,
        choice: input.choice,
        at: new Date().toISOString(),
      })
      if (!decided.ok) return { error: decided.error }
      const { patch, changed } = demographicsPatch(decided.demographics, decided.changedSections)
      if (decided.changedSections.length > 0) {
        await upsertBackgroundColumnInTx(tx, input.clientId, input.practiceId, input.userId, patch)
      }
      await tx
        .update(clientBackgroundInterviews)
        .set({ answersJson: decided.answers, updatedAt: new Date() })
        .where(eq(clientBackgroundInterviews.clientBackgroundInterviewId, interview.clientBackgroundInterviewId))
      await writeAudit(tx, {
        practiceId: input.practiceId,
        userId: input.userId,
        clientId: input.clientId,
        eventType:
          input.choice === "used"
            ? "client_background_interview.client_answer_used"
            : "client_background_interview.client_answer_kept",
        entityType: "client_background_interview",
        entityId: interview.clientBackgroundInterviewId,
      })
      return { answers: decided.answers, demographics: changed }
    })
  } catch {
    return { error: "Could not save your choice." }
  }
}

/**
 * "Accept N client changes and confirm": Use client's for every field still waiting in section 3
 * or 7 (values from the stored self-report), then confirm the section, in one transaction.
 */
export async function acceptInterviewClientChangesAndConfirm(input: {
  clientId: string
  practiceId: string
  userId: string
  sectionNumber: number
  detailHasValue: Record<string, boolean>
  fieldKeys: unknown
  selfReportId: unknown
}): Promise<{
  error?: string
  answers?: InterviewAnswersJson
  screening?: ScreeningAnswers
  demographics?: Partial<Demographics>
}> {
  const client = await assertClient(input.clientId, input.practiceId)
  if (!client) return { error: "Client was not found." }
  const suggestions = await shownSelfReportSuggestions(input.clientId, input.practiceId, input.selfReportId)
  if (!suggestions) return { error: SELF_REPORT_CHANGED_ERROR }
  const detailHasValue = Object.fromEntries(
    Object.entries(input.detailHasValue ?? {}).filter(([, value]) => typeof value === "boolean")
  )
  try {
    return await db
      .transaction(async (tx) => {
        const interview = await inProgressInterviewInTx(tx, input.clientId, input.practiceId)
        if (!interview) return { error: "There is no background interview in progress." }
        const family = await loadFamily(tx, input.clientId, input.practiceId)
        const accepted = acceptClientChangesAndConfirm({
          answers: sanitizeInterviewAnswers(interview.answersJson),
          demographics: await demographicsInTx(tx, input.clientId, input.practiceId),
          suggestions,
          relationships: family.people,
          sectionNumber: input.sectionNumber,
          detailHasValue,
          expectedFieldKeys: Array.isArray(input.fieldKeys) ? input.fieldKeys : [],
          at: new Date().toISOString(),
        })
        if (!accepted.ok) return { error: accepted.error }
        const { patch, changed } = demographicsPatch(accepted.demographics, accepted.changedSections)
        if (accepted.changedSections.length > 0) {
          await upsertBackgroundColumnInTx(tx, input.clientId, input.practiceId, input.userId, patch)
        }
        const screening = mergeScreeningMirror(sanitizeScreening(interview.screeningJson), accepted.answers)
        await tx
          .update(clientBackgroundInterviews)
          .set({ answersJson: accepted.answers, screeningJson: screening, updatedAt: new Date() })
          .where(eq(clientBackgroundInterviews.clientBackgroundInterviewId, interview.clientBackgroundInterviewId))
        const audit = {
          practiceId: input.practiceId,
          userId: input.userId,
          clientId: input.clientId,
          entityType: "client_background_interview",
          entityId: interview.clientBackgroundInterviewId,
        }
        if (accepted.appliedFieldKeys.length > 0) {
          await writeAudit(tx, { ...audit, eventType: "client_background_interview.client_changes_accepted" })
        }
        await writeAudit(tx, { ...audit, eventType: "client_background_interview.section_confirmed" })
        return { answers: accepted.answers, screening, demographics: changed }
      })
      .then(async (result) => {
        if (result.answers) {
          await writeBlockAnswerMirrors(input.clientId, input.practiceId, result.answers)
        }
        return result
      })
  } catch {
    return { error: "Could not confirm the interview section." }
  }
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
      const answers = sanitizeInterviewAnswers(interview.answersJson)
      const unfinished = sectionsNotConfirmed(answers)
      if (unfinished.length > 0) {
        return { error: "Confirm every interview section before completing." }
      }
      const screening = finalScreeningAnswers(
        mergeScreeningMirror(sanitizeScreening(interview.screeningJson), answers),
        events,
        dateOfBirth
      )
      const completedAt = new Date()
      const demographics = background ? demographicsFromStored(background) : emptyDemographics()
      const stressors = sanitizeStressors(background?.stressorsJson)
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
        stressors,
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
