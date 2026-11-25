import { and, desc, eq, inArray } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
} from "@/db/schema"
import { LRAMP_ELEMENTS } from "@/lib/assessments/definitions/lramp"
import { lrampShortDisposition } from "@/lib/assessments/lramp-summary"
import { db } from "@/lib/db"

export type AssessmentResultListRow = {
  assessmentResultId: string
  assessmentDate: Date
  score: number | null
  severity: string | null
  acuteRiskRating: string | null
  assessmentCode: string
  assessmentName: string
  /** Short disposition for LRAMP Score column; null for other instruments. */
  scoreLabel: string | null
}

export async function loadAssessmentResultsForClient(
  clientId: string,
  practiceId: string
): Promise<AssessmentResultListRow[]> {
  const results = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
      acuteRiskRating: assessmentResults.acuteRiskRating,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
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
        eq(assessmentResults.practiceId, practiceId)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const lrampInstanceIds = results
    .filter((row) => row.assessmentCode === "LRAMP")
    .map((row) => row.assessmentInstanceId)

  const dispositionByInstanceId = new Map<string, string>()

  if (lrampInstanceIds.length > 0) {
    // One query for all LRAMP F1 answers on this list — not one per row.
    const f1Rows = await db
      .select({
        assessmentInstanceId: assessmentResponses.assessmentInstanceId,
        responseValue: assessmentResponses.responseValue,
      })
      .from(assessmentResponses)
      .innerJoin(
        assessmentElements,
        eq(
          assessmentResponses.assessmentElementId,
          assessmentElements.assessmentElementId
        )
      )
      .where(
        and(
          inArray(
            assessmentResponses.assessmentInstanceId,
            lrampInstanceIds
          ),
          eq(assessmentElements.elementKey, "lramp_f1"),
          eq(assessmentResponses.clientId, clientId),
          eq(assessmentResponses.practiceId, practiceId)
        )
      )

    for (const row of f1Rows) {
      if (!row.responseValue) continue
      const label = lrampShortDisposition(LRAMP_ELEMENTS, {
        lramp_f1: [row.responseValue],
      })
      if (label) {
        dispositionByInstanceId.set(row.assessmentInstanceId, label)
      }
    }
  }

  return results.map((row) => ({
    assessmentResultId: row.assessmentResultId,
    assessmentDate: row.assessmentDate,
    score: row.score,
    severity: row.severity,
    acuteRiskRating: row.acuteRiskRating,
    assessmentCode: row.assessmentCode,
    assessmentName: row.assessmentName,
    scoreLabel: dispositionByInstanceId.get(row.assessmentInstanceId) ?? null,
  }))
}
