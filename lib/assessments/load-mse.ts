import { and, asc, eq } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "@/db/schema"
import type { MseQuestion } from "@/lib/assessments/mse-grouping"
import { db } from "@/lib/db"

export type { MseQuestion, MseQuestionGroup } from "@/lib/assessments/mse-grouping"
export { groupMseQuestions } from "@/lib/assessments/mse-grouping"

export async function loadMseQuestionnaire(): Promise<MseQuestion[] | null> {
  const [definition] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentDefinitions)
    .where(
      and(
        eq(assessmentDefinitions.assessmentCode, "mse"),
        eq(assessmentDefinitions.isActive, true)
      )
    )
    .limit(1)

  if (!definition) return null

  const elements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
      questionText: assessmentElements.questionText,
      groupLabel: assessmentElements.groupLabel,
      subgroupLabel: assessmentElements.subgroupLabel,
      displayOrder: assessmentElements.displayOrder,
    })
    .from(assessmentElements)
    .where(
      and(
        eq(
          assessmentElements.assessmentDefinitionId,
          definition.assessmentDefinitionId
        ),
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
      isDefaultSelection: assessmentOptions.isDefaultSelection,
    })
    .from(assessmentOptions)
    .where(
      eq(assessmentOptions.assessmentDefinitionId, definition.assessmentDefinitionId)
    )
    .orderBy(asc(assessmentOptions.displayOrder))

  const optionsByElement = new Map<
    string,
    { value: string; label: string; isDefaultSelection: boolean }[]
  >()
  for (const option of options) {
    const list = optionsByElement.get(option.assessmentElementId) ?? []
    list.push({
      value: option.optionValue,
      label: option.optionLabel,
      isDefaultSelection: option.isDefaultSelection,
    })
    optionsByElement.set(option.assessmentElementId, list)
  }

  return elements.map((element) => ({
    elementId: element.assessmentElementId,
    elementKey: element.elementKey,
    questionText: element.questionText,
    groupLabel: element.groupLabel,
    subgroupLabel: element.subgroupLabel,
    options: optionsByElement.get(element.assessmentElementId) ?? [],
  }))
}

export async function getMseDefinitionId(): Promise<string | null> {
  const [definition] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "mse"))
    .limit(1)

  return definition?.assessmentDefinitionId ?? null
}
