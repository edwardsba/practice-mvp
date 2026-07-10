import { and, eq, inArray } from "drizzle-orm"

import { assessmentElements, assessmentResponses } from "@/db/schema"
import { db } from "@/lib/db"

export const ASQ_Q5_ELEMENT_KEY = "asq_q5"

export const ASQ_RECENT_ELEMENT_KEYS = ["asq_q1", "asq_q2", "asq_q3"]

export function asqScreenOutcome(totalScore: number, q5ResponseValue: string): string {
  if (q5ResponseValue === "yes") return "Acute positive screen"
  if (totalScore === 0) return "Negative screen"
  return "Non-acute positive screen"
}

export async function getAsqRecentAndCurrentFlags(
  assessmentInstanceIds: string[]
): Promise<Map<string, { recentPositive: boolean; currentPositive: boolean }>> {
  const result = new Map<string, { recentPositive: boolean; currentPositive: boolean }>()

  if (assessmentInstanceIds.length === 0) {
    return result
  }

  for (const instanceId of assessmentInstanceIds) {
    result.set(instanceId, { recentPositive: false, currentPositive: false })
  }

  const rows = await db
    .select({
      assessmentInstanceId: assessmentResponses.assessmentInstanceId,
      elementKey: assessmentElements.elementKey,
      responseValue: assessmentResponses.responseValue,
    })
    .from(assessmentResponses)
    .innerJoin(
      assessmentElements,
      eq(assessmentResponses.assessmentElementId, assessmentElements.assessmentElementId)
    )
    .where(
      and(
        inArray(assessmentResponses.assessmentInstanceId, assessmentInstanceIds),
        inArray(assessmentElements.elementKey, [
          ...ASQ_RECENT_ELEMENT_KEYS,
          ASQ_Q5_ELEMENT_KEY,
        ])
      )
    )

  for (const row of rows) {
    const entry = result.get(row.assessmentInstanceId)
    if (!entry) continue

    if (
      ASQ_RECENT_ELEMENT_KEYS.includes(row.elementKey) &&
      row.responseValue === "yes"
    ) {
      entry.recentPositive = true
    }
    if (row.elementKey === ASQ_Q5_ELEMENT_KEY && row.responseValue === "yes") {
      entry.currentPositive = true
    }
  }

  return result
}
