"use server"

import { revalidatePath } from "next/cache"

import { requirePractitionerContext } from "@/lib/auth"
import {
  addBlockMember,
  createRelationshipBlock,
  createUnplacedPerson,
  deleteRelationshipBlock,
  moveBlockMember,
  removeBlockMember,
  saveRelationshipPersonDraft,
  saveRelationshipStatusWithCurrentBlock,
  setRelationshipBlockAnswer,
  updateBlockMember,
  updateRelationshipBlock,
  type CreateUnplacedPersonInput,
  type SaveRelationshipPersonDraftInput,
} from "@/lib/client-background/block-mutations"
import {
  completeBackgroundInterview,
  confirmInterviewSection,
  createEvent,
  createHistoryIssue,
  deleteEvent,
  saveDemographics,
  saveEducation,
  saveIdentity,
  saveInterviewAnswersBulk,
  saveInterviewItemAnswer,
  saveLivingSituation,
  saveOccupation,
  saveStressors,
  saveInterviewScreening,
  startBackgroundInterview,
  updateEvent,
  updateHistoryIssue,
  updateHistoryIssueTreatmentAnswer,
} from "@/lib/client-background/mutations"
import type { InterviewAnswerValue, InterviewAnswersJson } from "@/lib/client-background/interview-answers"
import type { BlockKind, BlockRole, RelationshipBlockAnswers, TreatmentAnswer } from "@/lib/client-background/types"
import { parseMedicareExpiryFromForm } from "@/lib/funding/format"
import { saveMedicareClaimDetails } from "@/lib/funding/save-medicare-claim"
import { ensureMedicalContact } from "@/lib/medical-contacts/mutations"

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}/background`)
  revalidatePath(`/clients/${clientId}/background/interview`)
  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/edit`)
}

async function ensurePrescriberOnMedicalContacts(
  clientId: string,
  practiceId: string,
  userId: string,
  event: unknown
) {
  if (!event || typeof event !== "object") return
  const row = event as {
    eventType?: string
    prescriberProfessionalId?: string | null
  }
  if (row.eventType !== "medication") return
  const professionalId = row.prescriberProfessionalId?.trim()
  if (!professionalId) return
  await ensureMedicalContact({
    clientId,
    practiceId,
    userId,
    professionalId,
  })
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

export async function createEventAction(clientId: string, event: unknown) {
  const context = await requirePractitionerContext()
  const result = await createEvent({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    event,
  })
  if (!result.error) {
    await ensurePrescriberOnMedicalContacts(
      clientId,
      context.practiceId,
      context.userId,
      result.event ?? event
    )
    refresh(clientId)
  }
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

export async function saveInterviewItemAnswerAction(
  clientId: string,
  itemKey: string,
  value: InterviewAnswerValue
) {
  const context = await requirePractitionerContext()
  const result = await saveInterviewItemAnswer({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    itemKey,
    value,
  })
  if (!result.error) refresh(clientId)
  return result
}

export type SaveMedicareInterviewState = {
  error?: string
  success?: boolean
}

/** Interview section 2: create or update the client's Medicare claim from MedicareFields. */
export async function saveMedicareInterviewAction(
  clientId: string,
  _prev: SaveMedicareInterviewState,
  formData: FormData
): Promise<SaveMedicareInterviewState> {
  const context = await requirePractitionerContext()
  const medicareCardNumber =
    String(formData.get("medicare_card_number") ?? "").trim() || null
  const medicareIrn = String(formData.get("medicare_irn") ?? "").trim() || null
  const medicareExpiry = parseMedicareExpiryFromForm(formData)
  const result = await saveMedicareClaimDetails({
    clientId,
    practiceId: context.practiceId,
    medicareCardNumber,
    medicareIrn,
    medicareExpiry,
  })
  if (result.error) return { error: result.error }
  refresh(clientId)
  revalidatePath(`/clients/${clientId}/claims`)
  revalidatePath(`/funding/claims`)
  return { success: true }
}

export async function saveInterviewAnswersBulkAction(clientId: string, answers: InterviewAnswersJson) {
  const context = await requirePractitionerContext()
  const result = await saveInterviewAnswersBulk({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    answers,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function confirmInterviewSectionAction(
  clientId: string,
  sectionNumber: number,
  detailHasValue: Record<string, boolean>,
  extraItems?: import("@/lib/client-background/interview-answers").InterviewItemDef[]
) {
  const context = await requirePractitionerContext()
  const result = await confirmInterviewSection({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    sectionNumber,
    detailHasValue,
    extraItems,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function completeBackgroundInterviewAction(
  clientId: string,
  selfReportId: string | null
) {
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
  if (!result.error) {
    await ensurePrescriberOnMedicalContacts(
      clientId,
      context.practiceId,
      context.userId,
      result.event ?? event
    )
    refresh(clientId)
  }
  return result
}

export async function updateHistoryIssueTreatmentAnswerAction(
  clientId: string,
  issueId: string,
  treatmentAnswer: TreatmentAnswer | ""
) {
  const context = await requirePractitionerContext()
  const result = await updateHistoryIssueTreatmentAnswer({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    issueId,
    treatmentAnswer,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function createHistoryIssueAction(
  clientId: string,
  issue: unknown,
  firstEpisode?: Parameters<typeof createHistoryIssue>[0]["firstEpisode"]
) {
  const context = await requirePractitionerContext()
  const result = await createHistoryIssue({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    issue,
    firstEpisode,
  })
  if (!result.error) refresh(clientId)
  return result
}

export async function updateHistoryIssueAction(clientId: string, issue: unknown) {
  const context = await requirePractitionerContext()
  const result = await updateHistoryIssue({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    issue,
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

export async function saveRelationshipPersonDraftAction(
  clientId: string,
  draft: Omit<SaveRelationshipPersonDraftInput, "clientId" | "practiceId" | "userId">
) {
  const context = await requirePractitionerContext()
  const result = await saveRelationshipPersonDraft({ ...scope(clientId, context), ...draft })
  if (result && !("error" in result && result.error)) refresh(clientId)
  return result
}

export async function createUnplacedPersonAction(
  clientId: string,
  draft?: string | Omit<CreateUnplacedPersonInput, "clientId" | "practiceId" | "userId">
) {
  const context = await requirePractitionerContext()
  // Back-compat: older call sites passed a bare givenName string.
  const fields = typeof draft === "string" ? { givenName: draft } : draft ?? {}
  const result = await createUnplacedPerson({ ...scope(clientId, context), ...fields })
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
