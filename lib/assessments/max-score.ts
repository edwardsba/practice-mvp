import { and, count, eq } from "drizzle-orm"

import { assessmentElements } from "@/db/schema"
import { db } from "@/lib/db"

/** Maximum score value per question (Not at all = 0 … Nearly every day = 3). */
const MAX_SCORE_PER_ELEMENT = 3

export async function getMaxScoreForAssessmentDefinition(
  assessmentDefinitionId: string
): Promise<number> {
  const [row] = await db
    .select({ elementCount: count() })
    .from(assessmentElements)
    .where(
      and(
        eq(assessmentElements.assessmentDefinitionId, assessmentDefinitionId),
        eq(assessmentElements.isActive, true),
        eq(assessmentElements.dataType, "integer")
      )
    )

  return Number(row?.elementCount ?? 0) * MAX_SCORE_PER_ELEMENT
}
