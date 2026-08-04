import { and, asc, eq, inArray } from "drizzle-orm"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  auditEvents,
} from "@/db/schema"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

export type QuestionnaireOption = {
  value: string
  label: string
}

export type QuestionnaireQuestion = {
  elementId: string
  questionText: string
  isRequired: boolean
  options: QuestionnaireOption[]
}

const PHQ9_STYLE_INSTRUCTION =
  "Over the last 2 weeks, how often have you been bothered by any of the following problems?"

const BTP_INSTRUCTION =
  "Over the past 2 weeks, how frequently did you practice your target behaviour, and how effective was it?"

const PSF_INSTRUCTION =
  "As a result of this session... Please choose the answer that best describes you."

const PC_PTSD5_INSTRUCTION =
  "Please answer the following questions as honestly as you can."

const PCL5_INSTRUCTION =
  "Keep a specific stressful experience in mind. In the past month, how much were you bothered by:"

export function questionnaireInstructionForCode(assessmentCode: string): string {
  if (assessmentCode === "BTP") {
    return BTP_INSTRUCTION
  }
  if (assessmentCode === "PSF") {
    return PSF_INSTRUCTION
  }
  if (assessmentCode === "PC_PTSD5") {
    // No shared timeframe claim here on purpose — the gate question is a lifetime question and
    // stands alone, while the 5 symptom items each now carry their own "In the past month..."
    // wording directly (see db/fix-pcptsd5-item-wording.ts). A single banner above both can't
    // correctly describe both timeframes at once.
    return PC_PTSD5_INSTRUCTION
  }
  if (assessmentCode === "PCL5") {
    return PCL5_INSTRUCTION
  }

  return PHQ9_STYLE_INSTRUCTION
}

export type QuestionnaireData = {
  assessmentName: string
  instructionText: string
  questions: QuestionnaireQuestion[]
  // Pre-filled defaults carried forward from an earlier instrument (e.g. the Specific Disorder
  // Selector), keyed by elementId. The corresponding question still renders normally and stays
  // fully editable — this only seeds the form's initial value, it's a default, not a lock.
  carriedResponses: Record<string, string>
  // Small, explicit, scoped mechanism — NOT general-purpose conditional-question
  // infrastructure. Currently only populated for PC_PTSD5: if the gate question is answered
  // "No", the 5 symptom items are hidden and auto-defaulted to "No" so the submission still
  // satisfies the backend's completeness check without the client ever seeing them.
  conditionalSkip: {
    triggerElementId: string
    triggerValue: string
    skippedDefaults: Record<string, string>
  } | null
}

function isLinkUsable(
  accessStatus: string,
  expiresAt: Date,
  allowSubmitted = false
) {
  if (expiresAt.getTime() <= Date.now()) {
    return false
  }

  if (accessStatus === "active") {
    return true
  }

  return allowSubmitted && accessStatus === "submitted"
}

async function loadElementsForInstance(
  assessmentCode: string,
  assessmentDefinitionId: string,
  assessmentInstanceId: string
) {
  if (assessmentCode === "BTP") {
    return db
      .select({
        assessmentElementId: assessmentElements.assessmentElementId,
        elementKey: assessmentElements.elementKey,
        questionText: assessmentElements.questionText,
        isRequired: assessmentElements.isRequired,
        displayOrder: assessmentElements.displayOrder,
      })
      .from(assessmentElements)
      .where(
        and(
          eq(assessmentElements.assessmentInstanceId, assessmentInstanceId),
          eq(assessmentElements.isActive, true)
        )
      )
      .orderBy(asc(assessmentElements.displayOrder))
  }

  return db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
      questionText: assessmentElements.questionText,
      isRequired: assessmentElements.isRequired,
      displayOrder: assessmentElements.displayOrder,
    })
    .from(assessmentElements)
    .where(
      and(
        eq(assessmentElements.assessmentDefinitionId, assessmentDefinitionId),
        eq(assessmentElements.isActive, true)
      )
    )
    .orderBy(asc(assessmentElements.displayOrder))
}

export async function loadQuestionnaireForToken(
  rawToken: string,
  loadOptions?: { allowSubmitted?: boolean }
): Promise<{ ok: true; data: QuestionnaireData } | { ok: false }> {
  const tokenHash = hashAssessmentToken(rawToken)

  const [accessLink] = await db
    .select()
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, tokenHash))
    .limit(1)

  if (
    !accessLink ||
    !isLinkUsable(
      accessLink.accessStatus,
      accessLink.expiresAt,
      loadOptions?.allowSubmitted
    )
  ) {
    return { ok: false }
  }

  if (!accessLink.openedAt) {
    await db.transaction(async (tx) => {
      await tx
        .update(assessmentAccessLinks)
        .set({
          openedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(assessmentAccessLinks.assessmentAccessLinkId, accessLink.assessmentAccessLinkId))

      await tx.insert(auditEvents).values({
        practiceId: accessLink.practiceId,
        clientId: accessLink.clientId,
        eventType: "assessment_link.opened",
        entityType: "assessment_access_link",
        entityId: accessLink.assessmentAccessLinkId,
      })
    })
  }

  const [instance] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      carriedResponsesJson: assessmentInstances.carriedResponsesJson,
    })
    .from(assessmentInstances)
    .where(
      eq(assessmentInstances.assessmentInstanceId, accessLink.assessmentInstanceId)
    )
    .limit(1)

  if (!instance) {
    return { ok: false }
  }

  const [definition] = await db
    .select({
      assessmentName: assessmentDefinitions.assessmentName,
      assessmentCode: assessmentDefinitions.assessmentCode,
    })
    .from(assessmentDefinitions)
    .where(
      eq(assessmentDefinitions.assessmentDefinitionId, instance.assessmentDefinitionId)
    )
    .limit(1)

  if (!definition) {
    return { ok: false }
  }

  const elements = await loadElementsForInstance(
    definition.assessmentCode,
    instance.assessmentDefinitionId,
    instance.assessmentInstanceId
  )

  const elementIds = elements.map((element) => element.assessmentElementId)

  const options =
    elementIds.length > 0
      ? await db
          .select({
            assessmentElementId: assessmentOptions.assessmentElementId,
            optionLabel: assessmentOptions.optionLabel,
            optionValue: assessmentOptions.optionValue,
            displayOrder: assessmentOptions.displayOrder,
          })
          .from(assessmentOptions)
          .where(inArray(assessmentOptions.assessmentElementId, elementIds))
          .orderBy(asc(assessmentOptions.displayOrder))
      : []

  const optionsByElement = new Map<string, QuestionnaireOption[]>()
  for (const option of options) {
    const list = optionsByElement.get(option.assessmentElementId) ?? []
    list.push({ value: option.optionValue, label: option.optionLabel })
    optionsByElement.set(option.assessmentElementId, list)
  }

  const questions: QuestionnaireQuestion[] = elements.map((element) => ({
    elementId: element.assessmentElementId,
    questionText: element.questionText,
    isRequired: element.isRequired,
    options: optionsByElement.get(element.assessmentElementId) ?? [],
  }))

  if (questions.length === 0 || questions.some((q) => q.options.length === 0)) {
    return { ok: false }
  }

  // carriedResponsesJson is keyed by elementKey (stable, human-readable) since it's written at
  // trigger time before this instance's own elements are queried. Resolve to elementId here so
  // the frontend can match it against QuestionnaireQuestion.elementId directly.
  const carriedResponsesByKey =
    (instance.carriedResponsesJson as Record<string, string> | null) ?? {}
  const carriedResponses: Record<string, string> = {}
  for (const element of elements) {
    const carriedValue = carriedResponsesByKey[element.elementKey]
    if (carriedValue !== undefined) {
      carriedResponses[element.assessmentElementId] = carriedValue
    }
  }

  let conditionalSkip: QuestionnaireData["conditionalSkip"] = null
  if (definition.assessmentCode === "PC_PTSD5") {
    const gateElement = elements.find((element) => element.elementKey === "pcptsd5_gate")
    const symptomElements = elements.filter((element) =>
      element.elementKey.startsWith("pcptsd5_q")
    )
    if (gateElement && symptomElements.length > 0) {
      conditionalSkip = {
        triggerElementId: gateElement.assessmentElementId,
        triggerValue: "0", // "No"
        skippedDefaults: Object.fromEntries(
          symptomElements.map((element) => [element.assessmentElementId, "0"])
        ),
      }
    }
  }

  return {
    ok: true,
    data: {
      assessmentName: definition.assessmentName,
      instructionText: questionnaireInstructionForCode(definition.assessmentCode),
      questions,
      carriedResponses,
      conditionalSkip,
    },
  }
}
