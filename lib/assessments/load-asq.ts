import { and, asc, eq } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "@/db/schema"
import { db } from "@/lib/db"

export type AsqQuestion = {
  elementId: string
  questionText: string
  options: { value: string; label: string }[]
}

export async function loadAsqQuestionnaire(): Promise<AsqQuestion[] | null> {
  const [definition] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentDefinitions)
    .where(
      and(
        eq(assessmentDefinitions.assessmentCode, "ASQ"),
        eq(assessmentDefinitions.isActive, true)
      )
    )
    .limit(1)

  if (!definition) return null

  const elements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      questionText: assessmentElements.questionText,
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
    })
    .from(assessmentOptions)
    .where(
      eq(assessmentOptions.assessmentDefinitionId, definition.assessmentDefinitionId)
    )
    .orderBy(asc(assessmentOptions.displayOrder))

  const optionsByElement = new Map<string, { value: string; label: string }[]>()
  for (const option of options) {
    const list = optionsByElement.get(option.assessmentElementId) ?? []
    list.push({ value: option.optionValue, label: option.optionLabel })
    optionsByElement.set(option.assessmentElementId, list)
  }

  return elements.map((element) => ({
    elementId: element.assessmentElementId,
    questionText: element.questionText,
    options: optionsByElement.get(element.assessmentElementId) ?? [],
  }))
}

export async function getAsqDefinitionId(): Promise<string | null> {
  const [definition] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "ASQ"))
    .limit(1)

  return definition?.assessmentDefinitionId ?? null
}
