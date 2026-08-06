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

// Fallback only — used for instruments Ben hasn't specified a real instruction for yet
// (see INSTRUCTION_BY_CODE below). Historically this was applied to nearly every instrument
// by default, which was wrong for most of them; kept only as the true fallback now.
const PHQ9_STYLE_INSTRUCTION =
  "Over the last 2 weeks, how often have you been bothered by any of the following problems?"

const BTP_INSTRUCTION =
  "Over the past 2 weeks, how frequently did you practice your target behaviour, and how effective was it?"

const PSF_INSTRUCTION =
  "As a result of this session... Please choose the answer that best describes you."

// Audited per-instrument instruction text — sourced from Ben's review of the diagnostic battery
// (Aug 2026), not written from memory. Codes intentionally left out here (SPECIFIC_DISORDER_SELECTOR,
// PHQ9, GAD7, ASSIST, BTP, PSF) fall through to PHQ9_STYLE_INSTRUCTION or their own constant below —
// Ben reviewed those and chose to leave them as-is rather than write new wording.
const INSTRUCTION_BY_CODE: Record<string, string> = {
  LEVEL1_XC:
    "During the past 2 weeks, how often have you been bothered by any of the following problems?",
  // No shared timeframe claim here on purpose — the gate question is a lifetime question and
  // stands alone, while the 5 symptom items each carry their own "In the past month..." wording
  // directly (see db/fix-pcptsd5-item-wording.ts). A single banner above both can't correctly
  // describe both timeframes at once.
  PC_PTSD5: "Please answer the following questions as honestly as you can.",
  ASRS_PART_A:
    "Please select the answer that best describes how you have felt and conducted yourself in the past 6 months.",
  ASRS_PART_B:
    "Please select the answer that best describes how you have felt and conducted yourself in the past 6 months.",
  PID5_FBF:
    "This is a list of things different people might say about themselves. We are interested in how you would describe yourself. There are no right or wrong answers, so you can describe yourself as honestly as possible. Please take your time and read each statement carefully, selecting the response that best describes you.",
  DASS21: "Please select the statement that best applied to you over the past week.",
  PHQ15:
    "Please select how often you have been bothered by any of these symptoms during the past 7 days.",
  SUBSTANCE_USE_L2:
    "Please select how often you have used these medicines and/or substances during the past 2 weeks.",
  DES_B:
    "Please select how often any of these things were true for you in the past 7 days.",
  SCI: "Thinking about a typical night in the last month …",
  ASRM:
    "Choose the one statement in each group that best describes the way you have been feeling for the past week.",
  PANIC_DISORDER: "During the past 7 days, I have…",
  AGORAPHOBIA: "During the past 7 days, I have…",
  SOCIAL_ANXIETY: "During the past 7 days, I have…",
  SEPARATION_ANXIETY: "During the past 7 days, I have…",
  SPECIFIC_PHOBIA:
    "Please select the statement that best applied to you over the past 7 days.",
  PCL5: "Below is a list of problems that people sometimes have in response to a very stressful experience. In the past month, how much were you bothered by:",
}

export function questionnaireInstructionForCode(assessmentCode: string): string {
  if (assessmentCode === "BTP") {
    return BTP_INSTRUCTION
  }
  if (assessmentCode === "PSF") {
    return PSF_INSTRUCTION
  }

  const audited = INSTRUCTION_BY_CODE[assessmentCode]
  if (audited) {
    return audited
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
  // Display-only context carried forward from an earlier instrument — e.g. Specific Phobia
  // showing which cluster the Specific Disorder Selector identified. Never a form field, never
  // written to assessment_responses; rendered as a banner above the questions if present.
  contextNote: string | null
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
      clientDisplayName: assessmentDefinitions.clientDisplayName,
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
  // "__context_note" is a reserved key, never a real elementKey — it never matches the loop
  // above, so it's read out separately here rather than risking collision with a real question.
  const contextNote =
    typeof carriedResponsesByKey.__context_note === "string"
      ? carriedResponsesByKey.__context_note
      : null

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
      assessmentName: definition.clientDisplayName || definition.assessmentName,
      instructionText: questionnaireInstructionForCode(definition.assessmentCode),
      questions,
      carriedResponses,
      contextNote,
      conditionalSkip,
    },
  }
}
