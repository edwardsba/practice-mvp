import { and, asc, eq } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "@/db/schema"
import type {
  FormElement,
  FormElementType,
  FormOption,
  FormShowWhen,
} from "@/lib/assessments/form-rules"
import { db } from "@/lib/db"

export type ElementScoreMeta = {
  domainCode: string | null
  dataType: string
}

export type LoadedFormDefinition = {
  assessmentDefinitionId: string
  assessmentCode: string
  assessmentName: string
  shortName: string
  scoringEnabled: boolean
  clientCompletable: boolean
  practitionerCompletable: boolean
  isActive: boolean
  elements: FormElement[]
  elementIdByKey: Record<string, string>
  /** Scoring metadata keyed by elementKey (domain + data type). */
  elementScoreMetaByKey: Record<string, ElementScoreMeta>
}

const ELEMENT_TYPES = new Set<FormElementType>([
  "radio",
  "yes_no",
  "checkbox",
  "tick",
  "text_list",
  "long_text",
  "short_text",
  "date",
])

function parseShowWhen(value: unknown): FormShowWhen | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const key = record.key
  const values = record.in
  if (typeof key !== "string" || !Array.isArray(values)) return null
  if (!values.every((item) => typeof item === "string")) return null
  return { key, in: values as string[] }
}

function asElementType(value: string): FormElementType {
  if (ELEMENT_TYPES.has(value as FormElementType)) {
    return value as FormElementType
  }
  return "radio"
}

/**
 * Load an active assessment definition by code with active elements and options,
 * mapped into Round AB FormElement[].
 */
export async function loadFormDefinitionByCode(
  assessmentCode: string
): Promise<LoadedFormDefinition | null> {
  const [definition] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
      scoringEnabled: assessmentDefinitions.scoringEnabled,
      clientCompletable: assessmentDefinitions.clientCompletable,
      practitionerCompletable: assessmentDefinitions.practitionerCompletable,
      isActive: assessmentDefinitions.isActive,
    })
    .from(assessmentDefinitions)
    .where(
      and(
        eq(assessmentDefinitions.assessmentCode, assessmentCode),
        eq(assessmentDefinitions.isActive, true)
      )
    )
    .limit(1)

  if (!definition) return null

  const elementRows = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
      questionText: assessmentElements.questionText,
      elementType: assessmentElements.elementType,
      displayOrder: assessmentElements.displayOrder,
      isRequired: assessmentElements.isRequired,
      groupLabel: assessmentElements.groupLabel,
      subgroupLabel: assessmentElements.subgroupLabel,
      parentElementKey: assessmentElements.parentElementKey,
      showWhenJson: assessmentElements.showWhenJson,
      requiredGroupKey: assessmentElements.requiredGroupKey,
      helpText: assessmentElements.helpText,
      domainCode: assessmentElements.domainCode,
      dataType: assessmentElements.dataType,
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

  const optionRows =
    elementRows.length === 0
      ? []
      : await db
          .select({
            assessmentElementId: assessmentOptions.assessmentElementId,
            optionLabel: assessmentOptions.optionLabel,
            optionValue: assessmentOptions.optionValue,
            scoreValue: assessmentOptions.scoreValue,
            displayOrder: assessmentOptions.displayOrder,
            isDefaultSelection: assessmentOptions.isDefaultSelection,
            isReportingBaseline: assessmentOptions.isReportingBaseline,
          })
          .from(assessmentOptions)
          .where(
            eq(
              assessmentOptions.assessmentDefinitionId,
              definition.assessmentDefinitionId
            )
          )
          .orderBy(asc(assessmentOptions.displayOrder))

  const optionsByElementId = new Map<string, FormOption[]>()
  for (const option of optionRows) {
    const list = optionsByElementId.get(option.assessmentElementId) ?? []
    list.push({
      label: option.optionLabel,
      value: option.optionValue,
      displayOrder: option.displayOrder,
      scoreValue: option.scoreValue,
      isDefaultSelection: option.isDefaultSelection,
      isReportingBaseline: option.isReportingBaseline,
    })
    optionsByElementId.set(option.assessmentElementId, list)
  }

  const elementIdByKey: Record<string, string> = {}
  const elementScoreMetaByKey: Record<string, ElementScoreMeta> = {}
  const elements: FormElement[] = elementRows.map((row) => {
    elementIdByKey[row.elementKey] = row.assessmentElementId
    elementScoreMetaByKey[row.elementKey] = {
      domainCode: row.domainCode,
      dataType: row.dataType,
    }
    return {
      elementKey: row.elementKey,
      elementType: asElementType(row.elementType),
      questionText: row.questionText,
      groupLabel: row.groupLabel,
      subgroupLabel: row.subgroupLabel,
      displayOrder: row.displayOrder,
      isRequired: row.isRequired,
      parentElementKey: row.parentElementKey,
      showWhen: parseShowWhen(row.showWhenJson),
      requiredGroupKey: row.requiredGroupKey,
      helpText: row.helpText,
      options: optionsByElementId.get(row.assessmentElementId) ?? [],
    }
  })

  return {
    assessmentDefinitionId: definition.assessmentDefinitionId,
    assessmentCode: definition.assessmentCode,
    assessmentName: definition.assessmentName,
    shortName: definition.assessmentCode,
    scoringEnabled: definition.scoringEnabled,
    clientCompletable: definition.clientCompletable,
    practitionerCompletable: definition.practitionerCompletable,
    isActive: definition.isActive,
    elements,
    elementIdByKey,
    elementScoreMetaByKey,
  }
}
