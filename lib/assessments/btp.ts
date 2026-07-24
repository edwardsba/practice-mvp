import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import * as schema from "@/db/schema"
import {
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
} from "@/db/schema"
import { db } from "@/lib/db"

export const BTP_RESPONSE_OPTIONS = [
  { label: "Not effective at all", value: "1", score: 1, order: 1 },
  { label: "Effective sometimes", value: "2", score: 2, order: 2 },
  { label: "Effective about half the time", value: "3", score: 3, order: 3 },
  { label: "Effective most of the time", value: "4", score: 4, order: 4 },
  { label: "Always effective", value: "5", score: 5, order: 5 },
] as const

export const BTP_RATING_LABELS: Record<number, string> = Object.fromEntries(
  BTP_RESPONSE_OPTIONS.map((option) => [option.score, option.label])
)

export type BtpInstanceElementsJson = {
  items: Array<{
    index: number
    elementKey: string
    elementId: string
    targetText: string
  }>
}

type DbExecutor = Pick<NodePgDatabase<typeof schema>, "insert" | "update">

export function btpElementKey(assessmentInstanceId: string, index: number): string {
  return `${assessmentInstanceId}_btp_target_${index}`
}

export function btpLogicalElementKey(index: number): string {
  return `btp_target_${index}`
}

export function btpQuestionText(target: string): string {
  return target
}

export function parseBtpInstanceElementsJson(
  value: unknown
): BtpInstanceElementsJson | null {
  if (!value || typeof value !== "object") return null
  const items = (value as BtpInstanceElementsJson).items
  if (!Array.isArray(items)) return null
  return {
    items: items
      .map((item) => ({
        index: Number(item.index),
        elementKey: String(item.elementKey ?? ""),
        elementId: String(item.elementId ?? ""),
        targetText: String(item.targetText ?? ""),
      }))
      .filter((item) => item.elementId && item.targetText),
  }
}

export function btpRatingLabel(score: number): string {
  return BTP_RATING_LABELS[score] ?? String(score)
}

export async function createBtpInstanceElements(
  assessmentInstanceId: string,
  behaviouralTargets: string[],
  assessmentDefinitionId: string,
  executor: DbExecutor = db
): Promise<BtpInstanceElementsJson> {
  const targets = behaviouralTargets.map((target) => target.trim()).filter(Boolean)
  const items: BtpInstanceElementsJson["items"] = []

  for (let index = 0; index < targets.length; index++) {
    const targetText = targets[index]
    const logicalKey = btpLogicalElementKey(index)
    const storageKey = btpElementKey(assessmentInstanceId, index)

    const [element] = await executor
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId,
        assessmentInstanceId,
        elementKey: storageKey,
        questionText: btpQuestionText(targetText),
        elementType: "radio",
        dataType: "integer",
        displayOrder: index + 1,
        isRequired: true,
        isActive: true,
      })
      .returning({
        assessmentElementId: assessmentElements.assessmentElementId,
      })

    await executor.insert(assessmentOptions).values(
      BTP_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )

    items.push({
      index,
      elementKey: logicalKey,
      elementId: element.assessmentElementId,
      targetText,
    })
  }

  const instanceElementsJson: BtpInstanceElementsJson = { items }

  await executor
    .update(assessmentInstances)
    .set({
      instanceElementsJson,
      updatedAt: new Date(),
    })
    .where(eq(assessmentInstances.assessmentInstanceId, assessmentInstanceId))

  return instanceElementsJson
}
