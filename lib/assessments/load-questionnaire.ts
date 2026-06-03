import { and, asc, eq } from "drizzle-orm"

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
  options: QuestionnaireOption[]
}

export type QuestionnaireData = {
  assessmentName: string
  questions: QuestionnaireQuestion[]
}

function isLinkUsable(accessStatus: string, expiresAt: Date) {
  return accessStatus === "active" && expiresAt.getTime() > Date.now()
}

export async function loadQuestionnaireForToken(
  rawToken: string
): Promise<{ ok: true; data: QuestionnaireData } | { ok: false }> {
  const tokenHash = hashAssessmentToken(rawToken)

  const [accessLink] = await db
    .select()
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, tokenHash))
    .limit(1)

  if (!accessLink || !isLinkUsable(accessLink.accessStatus, accessLink.expiresAt)) {
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
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
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
    })
    .from(assessmentDefinitions)
    .where(
      eq(assessmentDefinitions.assessmentDefinitionId, instance.assessmentDefinitionId)
    )
    .limit(1)

  if (!definition) {
    return { ok: false }
  }

  const elements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      questionText: assessmentElements.questionText,
      displayOrder: assessmentElements.displayOrder,
    })
    .from(assessmentElements)
    .where(
      and(
        eq(assessmentElements.assessmentDefinitionId, instance.assessmentDefinitionId),
        eq(assessmentElements.isActive, true)
      )
    )
    .orderBy(asc(assessmentElements.displayOrder))

  const options = await db
    .select({
      assessmentElementId: assessmentOptions.assessmentElementId,
      optionLabel: assessmentOptions.optionLabel,
      optionValue: assessmentOptions.optionValue,
      displayOrder: assessmentOptions.displayOrder,
    })
    .from(assessmentOptions)
    .where(
      eq(assessmentOptions.assessmentDefinitionId, instance.assessmentDefinitionId)
    )
    .orderBy(asc(assessmentOptions.displayOrder))

  const optionsByElement = new Map<string, QuestionnaireOption[]>()
  for (const option of options) {
    const list = optionsByElement.get(option.assessmentElementId) ?? []
    list.push({ value: option.optionValue, label: option.optionLabel })
    optionsByElement.set(option.assessmentElementId, list)
  }

  const questions: QuestionnaireQuestion[] = elements.map((element) => ({
    elementId: element.assessmentElementId,
    questionText: element.questionText,
    options: optionsByElement.get(element.assessmentElementId) ?? [],
  }))

  if (questions.some((q) => q.options.length === 0)) {
    return { ok: false }
  }

  return {
    ok: true,
    data: {
      assessmentName: definition.assessmentName,
      questions,
    },
  }
}
