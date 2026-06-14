"use server"

import { and, asc, eq, sql } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export async function getAssessmentDefinitions(_practiceId?: string) {
  await requirePractitionerContext()

  const definitions = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
      assessmentType: assessmentDefinitions.assessmentType,
      description: assessmentDefinitions.description,
      scoringEnabled: assessmentDefinitions.scoringEnabled,
      clientCompletable: assessmentDefinitions.clientCompletable,
      practitionerCompletable: assessmentDefinitions.practitionerCompletable,
      isActive: assessmentDefinitions.isActive,
    })
    .from(assessmentDefinitions)
    .orderBy(asc(assessmentDefinitions.assessmentName))

  const elementCounts = await db
    .select({
      assessmentDefinitionId: assessmentElements.assessmentDefinitionId,
      elementCount: sql<number>`count(*)::int`,
    })
    .from(assessmentElements)
    .where(eq(assessmentElements.isActive, true))
    .groupBy(assessmentElements.assessmentDefinitionId)

  const countByDefinitionId = new Map(
    elementCounts.map((row) => [row.assessmentDefinitionId, row.elementCount])
  )

  return definitions.map((definition) => ({
    ...definition,
    elementCount: countByDefinitionId.get(definition.assessmentDefinitionId) ?? 0,
  }))
}

export async function getAssessmentDefinitionByCode(assessmentCode: string) {
  await requirePractitionerContext()

  const [definition] = await db
    .select()
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, assessmentCode))
    .limit(1)

  if (!definition) {
    return null
  }

  const elements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
      questionText: assessmentElements.questionText,
      elementType: assessmentElements.elementType,
      displayOrder: assessmentElements.displayOrder,
      isRequired: assessmentElements.isRequired,
    })
    .from(assessmentElements)
    .where(
      and(
        eq(assessmentElements.assessmentDefinitionId, definition.assessmentDefinitionId),
        eq(assessmentElements.isActive, true)
      )
    )
    .orderBy(asc(assessmentElements.displayOrder))

  const elementIds = elements.map((element) => element.assessmentElementId)

  const options =
    elementIds.length === 0
      ? []
      : await db
          .select({
            assessmentElementId: assessmentOptions.assessmentElementId,
            optionLabel: assessmentOptions.optionLabel,
            optionValue: assessmentOptions.optionValue,
            scoreValue: assessmentOptions.scoreValue,
            displayOrder: assessmentOptions.displayOrder,
          })
          .from(assessmentOptions)
          .where(
            eq(
              assessmentOptions.assessmentDefinitionId,
              definition.assessmentDefinitionId
            )
          )
          .orderBy(asc(assessmentOptions.displayOrder))

  const optionsByElementId = new Map<
    string,
    Array<(typeof options)[number]>
  >()

  for (const option of options) {
    const existing = optionsByElementId.get(option.assessmentElementId) ?? []
    existing.push(option)
    optionsByElementId.set(option.assessmentElementId, existing)
  }

  return {
    ...definition,
    elements: elements.map((element) => ({
      ...element,
      options: optionsByElementId.get(element.assessmentElementId) ?? [],
    })),
  }
}
