import { and, eq } from "drizzle-orm"

import {
  auditEvents,
  intakeEventRecords,
  intakeInterviews,
  intakeRelationshipRecords,
} from "@/db/schema"
import { db } from "@/lib/db"
import {
  loadIntakeInterviewForPractice,
} from "@/lib/intake-interview/load"
import { toStoredEvent, toStoredRelationship } from "@/lib/intake-interview/serialize"
import { summariseFamilyOfOrigin, summarisePartnersAndChildren } from "@/lib/intake-interview/summaries"
import type { IntakeInterviewPayload } from "@/lib/intake-interview/types"
import { sanitizePayload } from "@/lib/intake-interview/sanitize"

function parentColumns(payload: IntakeInterviewPayload) {
  const clean = sanitizePayload(payload)
  return {
    interviewDate: clean.interviewDate || null,
    identityJson: clean.identity,
    familyOfOriginRosterJson: clean.familyOfOriginRoster,
    partnersChildrenRosterJson: clean.partnersChildrenRoster,
    familyOfOriginSummary: summariseFamilyOfOrigin(clean.familyOfOriginRoster),
    partnersChildrenSummary: summarisePartnersAndChildren(
      clean.partnersChildrenRoster,
      clean.relationships
    ),
    familyHistoryJson: clean.familyHistory,
    livingSituationJson: clean.livingSituation,
    educationJson: clean.education,
    occupationJson: clean.occupation,
    financialSituationJson: clean.financial,
    socialSupportJson: clean.socialSupport,
    payload: clean,
  }
}

function sortRelationshipsForInsert(payload: IntakeInterviewPayload) {
  return [...payload.relationships].sort((a, b) => {
    const aLinked = a.linkedPartnerRecordId ? 1 : 0
    const bLinked = b.linkedPartnerRecordId ? 1 : 0
    if (aLinked !== bLinked) return aLinked - bLinked
    return a.displayOrder - b.displayOrder
  })
}

async function replaceChildRows(params: {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  interviewId: string
  clientId: string
  practiceId: string
  payload: IntakeInterviewPayload
}) {
  const { tx, interviewId, clientId, practiceId, payload } = params

  await tx
    .delete(intakeEventRecords)
    .where(eq(intakeEventRecords.intakeInterviewId, interviewId))

  await tx
    .update(intakeRelationshipRecords)
    .set({ linkedPartnerRecordId: null, updatedAt: new Date() })
    .where(eq(intakeRelationshipRecords.intakeInterviewId, interviewId))

  await tx
    .delete(intakeRelationshipRecords)
    .where(eq(intakeRelationshipRecords.intakeInterviewId, interviewId))

  const relationships = sortRelationshipsForInsert(payload)
  const partners = relationships.filter((record) => !record.linkedPartnerRecordId)
  const linked = relationships.filter((record) => record.linkedPartnerRecordId)

  if (partners.length > 0) {
    await tx.insert(intakeRelationshipRecords).values(
      partners.map((record) => ({
        ...toStoredRelationship(record),
        intakeInterviewId: interviewId,
        clientId,
        practiceId,
      }))
    )
  }

  if (linked.length > 0) {
    await tx.insert(intakeRelationshipRecords).values(
      linked.map((record) => ({
        ...toStoredRelationship(record),
        intakeInterviewId: interviewId,
        clientId,
        practiceId,
      }))
    )
  }

  if (payload.events.length > 0) {
    await tx.insert(intakeEventRecords).values(
      payload.events.map((event) => ({
        ...toStoredEvent(event),
        intakeInterviewId: interviewId,
        clientId,
        practiceId,
      }))
    )
  }
}

export async function commitIntakeInterview(params: {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  userId: string
  sourceInterviewId: string | null
  payload: IntakeInterviewPayload
  finalise: boolean
}): Promise<{ intakeInterviewId: string }> {
  const { payload: clean, ...columns } = parentColumns(params.payload)
  const now = new Date()

  if (params.sourceInterviewId) {
    const source = await loadIntakeInterviewForPractice(
      params.sourceInterviewId,
      params.clientId,
      params.practiceId
    )
    if (!source) {
      throw new Error("Intake interview not found.")
    }
    if (source.status === "finalised") {
      throw new Error("Finalised intake interviews cannot be overwritten.")
    }

    await db.transaction(async (tx) => {
      await tx
        .update(intakeInterviews)
        .set({
          ...columns,
          practitionerProfileId: params.practitionerProfileId,
          status: params.finalise ? "finalised" : "draft",
          finalisedAt: params.finalise ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(intakeInterviews.intakeInterviewId, params.sourceInterviewId!),
            eq(intakeInterviews.practiceId, params.practiceId)
          )
        )

      await replaceChildRows({
        tx,
        interviewId: params.sourceInterviewId!,
        clientId: params.clientId,
        practiceId: params.practiceId,
        payload: clean,
      })

      await tx.insert(auditEvents).values({
        practiceId: params.practiceId,
        userId: params.userId,
        clientId: params.clientId,
        eventType: params.finalise
          ? "intake_interview.finalised"
          : "intake_interview.updated",
        entityType: "intake_interview",
        entityId: params.sourceInterviewId!,
      })
    })

    return { intakeInterviewId: params.sourceInterviewId }
  }

  let newId!: string
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(intakeInterviews)
      .values({
        clientId: params.clientId,
        practiceId: params.practiceId,
        practitionerProfileId: params.practitionerProfileId,
        versionNumber: 1,
        isCurrentVersion: true,
        isActive: true,
        ...columns,
        status: params.finalise ? "finalised" : "draft",
        finalisedAt: params.finalise ? now : null,
        updatedAt: now,
      })
      .returning({ intakeInterviewId: intakeInterviews.intakeInterviewId })

    newId = inserted.intakeInterviewId

    await replaceChildRows({
      tx,
      interviewId: newId,
      clientId: params.clientId,
      practiceId: params.practiceId,
      payload: clean,
    })

    await tx.insert(auditEvents).values({
      practiceId: params.practiceId,
      userId: params.userId,
      clientId: params.clientId,
      eventType: params.finalise
        ? "intake_interview.finalised"
        : "intake_interview.created",
      entityType: "intake_interview",
      entityId: newId,
    })
  })

  return { intakeInterviewId: newId }
}

export async function createIntakeInterviewVersion(params: {
  previousVersionId: string
  clientId: string
  practiceId: string
  practitionerProfileId: string
  userId: string
}): Promise<{ intakeInterviewId: string }> {
  const previous = await loadIntakeInterviewForPractice(
    params.previousVersionId,
    params.clientId,
    params.practiceId
  )
  if (!previous) {
    throw new Error("Intake interview not found.")
  }
  if (previous.status !== "finalised") {
    throw new Error("Only a finalised intake interview can be versioned.")
  }

  const nextVersion = previous.versionNumber + 1
  let newId!: string

  await db.transaction(async (tx) => {
    await tx
      .update(intakeInterviews)
      .set({ isCurrentVersion: false, updatedAt: new Date() })
      .where(eq(intakeInterviews.intakeInterviewId, params.previousVersionId))

    const { payload: clean, ...columns } = parentColumns(previous.payload)

    const [inserted] = await tx
      .insert(intakeInterviews)
      .values({
        clientId: params.clientId,
        practiceId: params.practiceId,
        practitionerProfileId: params.practitionerProfileId,
        versionNumber: nextVersion,
        isCurrentVersion: true,
        previousVersionId: params.previousVersionId,
        isActive: true,
        ...columns,
        status: "draft",
        finalisedAt: null,
        updatedAt: new Date(),
      })
      .returning({ intakeInterviewId: intakeInterviews.intakeInterviewId })

    newId = inserted.intakeInterviewId

    const idMap = new Map<string, string>()
    const remappedRelationships = clean.relationships.map((record) => {
      const nextId = crypto.randomUUID()
      idMap.set(record.relationshipRecordId, nextId)
      return { ...record, relationshipRecordId: nextId }
    })
    const withLinks = remappedRelationships.map((record) => ({
      ...record,
      linkedPartnerRecordId: record.linkedPartnerRecordId
        ? (idMap.get(record.linkedPartnerRecordId) ?? null)
        : null,
    }))
    const remappedEvents = clean.events.map((event) => ({
      ...event,
      eventRecordId: crypto.randomUUID(),
      relationshipRecordId: event.relationshipRecordId
        ? (idMap.get(event.relationshipRecordId) ?? null)
        : null,
    }))
    const remappedSelected = clean.familyHistory.selectedRelationshipIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id))

    const remappedPayload: IntakeInterviewPayload = {
      ...clean,
      relationships: withLinks,
      events: remappedEvents,
      familyHistory: { selectedRelationshipIds: remappedSelected },
      partnersChildrenRoster: {
        ...clean.partnersChildrenRoster,
        childrenByPartnerId: Object.fromEntries(
          Object.entries(clean.partnersChildrenRoster.childrenByPartnerId).flatMap(
            ([oldId, counts]) => {
              const nextId = idMap.get(oldId)
              return nextId ? [[nextId, counts]] : []
            }
          )
        ),
      },
    }

    await tx
      .update(intakeInterviews)
      .set({
        familyHistoryJson: remappedPayload.familyHistory,
        partnersChildrenRosterJson: remappedPayload.partnersChildrenRoster,
        updatedAt: new Date(),
      })
      .where(eq(intakeInterviews.intakeInterviewId, newId))

    await replaceChildRows({
      tx,
      interviewId: newId,
      clientId: params.clientId,
      practiceId: params.practiceId,
      payload: remappedPayload,
    })

    await tx.insert(auditEvents).values({
      practiceId: params.practiceId,
      userId: params.userId,
      clientId: params.clientId,
      eventType: "intake_interview.version_created",
      entityType: "intake_interview",
      entityId: newId,
    })
  })

  return { intakeInterviewId: newId }
}
