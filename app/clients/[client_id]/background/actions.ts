"use server"

import { revalidatePath } from "next/cache"

import { requirePractitionerContext } from "@/lib/auth"
import {
  completeBackgroundInterview,
  createEvent,
  createRelationship,
  deleteEvent,
  deleteRelationship,
  saveClientRelationshipStatus,
  saveDemographics,
  saveEducation,
  saveIdentity,
  saveLivingSituation,
  saveOccupation,
  saveRisk,
  saveInterviewScreening,
  startBackgroundInterview,
  updateEvent,
  updatePartnership,
  updateRelationshipDetail,
} from "@/lib/client-background/mutations"
import type { EventType, RelationshipRelink } from "@/lib/client-background/types"

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}/background`)
  revalidatePath(`/clients/${clientId}/background/interview`)
  revalidatePath(`/clients/${clientId}`)
}

export async function saveIdentityAction(clientId: string, identity: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveIdentity({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    identity,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function saveLivingSituationAction(clientId: string, livingSituation: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveLivingSituation({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    livingSituation,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function saveEducationAction(clientId: string, education: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveEducation({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    education,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function saveOccupationAction(clientId: string, occupation: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveOccupation({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    occupation,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function saveDemographicsAction(clientId: string, demographics: unknown) {
  const context = await requirePractitionerContext()
  const raw =
    demographics && typeof demographics === "object"
      ? (demographics as Record<string, unknown>)
      : {}
  const result = await saveDemographics({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    identity: raw.identity,
    livingSituation: raw.livingSituation,
    education: raw.education,
    occupation: raw.occupation,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function saveClientRelationshipStatusAction(clientId: string, relationshipStatus: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveClientRelationshipStatus({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    relationshipStatus,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function saveRiskAction(clientId: string, risk: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveRisk({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    risk,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function createRelationshipAction(
  clientId: string,
  relationship: unknown,
  associatedParentId?: string | null,
  clientRelationshipStatus?: unknown
) {
  const context = await requirePractitionerContext()
  const result = await createRelationship({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    relationship,
    associatedParentId,
    clientRelationshipStatus,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function updateRelationshipAction(
  clientId: string,
  relationship: unknown,
  partnerships: unknown,
  options?: {
    associatedParentId?: string | null
    relink?: RelationshipRelink | null
    clientRelationshipStatus?: unknown
  }
) {
  const context = await requirePractitionerContext()
  const result = await updateRelationshipDetail({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    relationship,
    partnerships,
    associatedParentId: options?.associatedParentId,
    relink: options?.relink,
    clientRelationshipStatus: options?.clientRelationshipStatus,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function updatePartnershipAction(clientId: string, partnership: unknown) {
  const context = await requirePractitionerContext()
  const result = await updatePartnership({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    partnership,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function deleteRelationshipAction(clientId: string, relationshipRecordId: string) {
  const context = await requirePractitionerContext()
  const result = await deleteRelationship({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    relationshipRecordId,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function createEventAction(clientId: string, eventType: EventType, initial?: unknown) {
  const context = await requirePractitionerContext()
  const result = await createEvent({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    eventType,
    initial,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function startBackgroundInterviewAction(clientId: string) {
  const context = await requirePractitionerContext()
  const result = await startBackgroundInterview({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    practitionerProfileId: context.practitionerProfileId,
  })
  if (result.interviewId) refresh(clientId)
  return result
}

export async function saveInterviewScreeningAction(clientId: string, screening: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveInterviewScreening({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    screening,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function completeBackgroundInterviewAction(clientId: string) {
  const context = await requirePractitionerContext()
  const result = await completeBackgroundInterview({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function updateEventAction(clientId: string, event: unknown) {
  const context = await requirePractitionerContext()
  const result = await updateEvent({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    event,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function deleteEventAction(clientId: string, eventRecordId: string) {
  const context = await requirePractitionerContext()
  const result = await deleteEvent({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    eventRecordId,
  })
  if (!result.error) refresh(clientId)
  return result
}
