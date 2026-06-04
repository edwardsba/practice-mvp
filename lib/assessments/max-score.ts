import { and, eq, max } from "drizzle-orm"

import { assessmentElements, assessmentOptions } from "@/db/schema"
import { db } from "@/lib/db"

/** Sum of each scored element's highest option score_value (integer elements only). */
export async function getMaxScoreForAssessmentDefinition(
  assessmentDefinitionId: string
): Promise<number> {
  const rows = await db
    .select({
      maxScore: max(assessmentOptions.scoreValue),
    })
    .from(assessmentOptions)
    .innerJoin(
      assessmentElements,
      eq(
        assessmentOptions.assessmentElementId,
        assessmentElements.assessmentElementId
      )
    )
    .where(
      and(
        eq(assessmentElements.assessmentDefinitionId, assessmentDefinitionId),
        eq(assessmentElements.isActive, true),
        eq(assessmentElements.dataType, "integer")
      )
    )
    .groupBy(assessmentOptions.assessmentElementId)

  return rows.reduce((total, row) => total + Number(row.maxScore ?? 0), 0)
}
