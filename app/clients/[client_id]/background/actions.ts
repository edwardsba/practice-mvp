"use server"

import { revalidatePath } from "next/cache"

import { requirePractitionerContext } from "@/lib/auth"
import {
  createEvent,
  createRelationship,
  deleteEvent,
  deleteRelationship,
  saveDemographics,
  saveEducation,
  saveIdentity,
  saveLivingSituation,
  saveOccupation,
  saveRisk,
  updateEvent,
  updatePartnership,
  updateRelationshipDetail,
} from "@/lib/client-background/mutations"
import type { EventType, RelationshipRelink } from "@/lib/client-background/types"

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}/background`)
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
  associatedParentId?: string | null
) {
  const context = await requirePractitionerContext()
  const result = await createRelationship({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    relationship,
    associatedParentId,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function updateRelationshipAction(
  clientId: string,
  relationship: unknown,
  partnerships: unknown,
  options?: { associatedParentId?: string | null; relink?: RelationshipRelink | null }
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

export async function createEventAction(clientId: string, eventType: EventType) {
  const context = await requirePractitionerContext()
  const result = await createEvent({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    eventType,
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
