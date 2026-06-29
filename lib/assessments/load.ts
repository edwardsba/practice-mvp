import { and, desc, eq } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
} from "@/db/schema"
import { db } from "@/lib/db"

export async function loadLatestAssessmentResultForClient(
  clientId: string,
  practiceId: string,
  assessmentCode: string
) {
  const [row] = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
      assessmentDate: assessmentResults.assessmentDate,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(
        assessmentResults.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, assessmentCode)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))
    .limit(1)

  return row ?? null
}
