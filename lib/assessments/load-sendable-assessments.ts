import { and, count, eq, inArray } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
} from "@/db/schema"
import {
  displayLabelForAssessment,
  orderSendableAssessments,
  qualifiesAsSendable,
  type SendableAssessment,
} from "@/lib/assessments/sendable-assessments"
import { db } from "@/lib/db"

/**
 * Active client-completable definitions with elements (plus BTP), minus
 * SEND_LIST_EXCEPTIONS, ordered for the Send chips / battery chain.
 */
export async function loadSendableAssessments(): Promise<SendableAssessment[]> {
  const definitions = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
      clientDisplayName: assessmentDefinitions.clientDisplayName,
      isActive: assessmentDefinitions.isActive,
      clientCompletable: assessmentDefinitions.clientCompletable,
    })
    .from(assessmentDefinitions)
    .where(
      and(
        eq(assessmentDefinitions.isActive, true),
        eq(assessmentDefinitions.clientCompletable, true)
      )
    )

  if (definitions.length === 0) return []

  const definitionIds = definitions.map((row) => row.assessmentDefinitionId)
  const elementCountRows = await db
    .select({
      assessmentDefinitionId: assessmentElements.assessmentDefinitionId,
      activeCount: count(),
    })
    .from(assessmentElements)
    .where(
      and(
        inArray(assessmentElements.assessmentDefinitionId, definitionIds),
        eq(assessmentElements.isActive, true)
      )
    )
    .groupBy(assessmentElements.assessmentDefinitionId)

  const countByDefinitionId = new Map(
    elementCountRows.map((row) => [
      row.assessmentDefinitionId,
      Number(row.activeCount),
    ])
  )

  const sendable = definitions
    .filter((row) =>
      qualifiesAsSendable({
        assessmentCode: row.assessmentCode,
        isActive: row.isActive,
        clientCompletable: row.clientCompletable,
        hasActiveElements: (countByDefinitionId.get(row.assessmentDefinitionId) ?? 0) > 0,
      })
    )
    .map((row) => ({
      assessmentCode: row.assessmentCode,
      assessmentName: row.assessmentName,
      displayLabel: displayLabelForAssessment({
        assessmentCode: row.assessmentCode,
        assessmentName: row.assessmentName,
        clientDisplayName: row.clientDisplayName,
      }),
    }))

  return orderSendableAssessments(sendable)
}

/**
 * Load sendable definitions keyed by uppercased code → exact DB row.
 * Used to validate and canonicalise requested battery codes.
 */
export async function loadSendableAssessmentByUpperCode(): Promise<
  Map<string, SendableAssessment>
> {
  const list = await loadSendableAssessments()
  return new Map(list.map((item) => [item.assessmentCode.toUpperCase(), item]))
}
