"use server"

import { revalidatePath } from "next/cache"

import { requirePractitionerContext } from "@/lib/auth"
import {
  addBlockMember,
  createRelationshipBlock,
  deleteRelationshipBlock,
  moveBlockMember,
  removeBlockMember,
  saveRelationshipStatusWithCurrentBlock,
  setRelationshipBlockAnswer,
  updateBlockMember,
  updateRelationshipBlock,
} from "@/lib/client-background/block-mutations"
import {
  completeBackgroundInterview,
  createEvent,
  deleteEvent,
  saveClientRelationshipStatus,
  saveDemographics,
  saveEducation,
  saveIdentity,
  saveLivingSituation,
  saveOccupation,
  saveRisk,
  saveReasonForAttending,
  saveStressors,
  saveInterviewScreening,
  startBackgroundInterview,
  updateEvent,
} from "@/lib/client-background/mutations"
import type { BlockKind, BlockRole, RelationshipBlockAnswers } from "@/lib/client-background/types"

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

export async function saveStressorsAction(clientId: string, stressors: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveStressors({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    stressors,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function saveReasonForAttendingAction(clientId: string, reason: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveReasonForAttending({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    reason,
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

export async function createEventAction(clientId: string, event: unknown) {
  const context = await requirePractitionerContext()
  const result = await createEvent({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    event,
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

export async function completeBackgroundInterviewAction(clientId: string, selfReportId: string | null) {
  const context = await requirePractitionerContext()
  const result = await completeBackgroundInterview({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    selfReportId,
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

function scope(clientId: string, context: { practiceId: string; userId: string }) {
  return { clientId, practiceId: context.practiceId, userId: context.userId }
}

export async function saveRelationshipStatusBlockAction(clientId: string, relationshipStatus: unknown) {
  const context = await requirePractitionerContext()
  const result = await saveRelationshipStatusWithCurrentBlock({ ...scope(clientId, context), relationshipStatus })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function createRelationshipBlockAction(
  clientId: string,
  kind: BlockKind,
  options?: { parentSide?: "mother" | "father" | ""; arrangementType?: string }
) {
  const context = await requirePractitionerContext()
  const result = await createRelationshipBlock({ ...scope(clientId, context), kind, ...options })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function updateRelationshipBlockAction(clientId: string, block: unknown) {
  const context = await requirePractitionerContext()
  const result = await updateRelationshipBlock({ ...scope(clientId, context), block })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function deleteRelationshipBlockAction(clientId: string, relationshipBlockId: string) {
  const context = await requirePractitionerContext()
  const result = await deleteRelationshipBlock({ ...scope(clientId, context), relationshipBlockId })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function setRelationshipBlockAnswerAction(
  clientId: string,
  key: keyof RelationshipBlockAnswers,
  value: string
) {
  const context = await requirePractitionerContext()
  const result = await setRelationshipBlockAnswer({ ...scope(clientId, context), key, value })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function addBlockMemberAction(
  clientId: string,
  relationshipBlockId: string,
  role: BlockRole,
  roleType?: string
) {
  const context = await requirePractitionerContext()
  const result = await addBlockMember({ ...scope(clientId, context), relationshipBlockId, role, roleType })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function updateBlockMemberAction(clientId: string, relationship: unknown) {
  const context = await requirePractitionerContext()
  const result = await updateBlockMember({ ...scope(clientId, context), relationship })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function removeBlockMemberAction(clientId: string, relationshipRecordId: string) {
  const context = await requirePractitionerContext()
  const result = await removeBlockMember({ ...scope(clientId, context), relationshipRecordId })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function moveBlockMemberAction(
  clientId: string,
  relationshipRecordId: string,
  relationshipBlockId: string,
  role: BlockRole,
  roleType?: string
) {
  const context = await requirePractitionerContext()
  const result = await moveBlockMember({
    ...scope(clientId, context),
    relationshipRecordId,
    relationshipBlockId,
    role,
    roleType,
  })
  if (result && !("error" in result && result.error)) refresh(clientId)
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
