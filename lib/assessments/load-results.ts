import { and, desc, eq, inArray } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
} from "@/db/schema"
import { loadFormDefinitionByCode } from "@/lib/assessments/load-form-definition"
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
  /** Score-column text for LRAMP (disposition) and mse (severity); null otherwise. */
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

  const scoreLabelByInstanceId = new Map<string, string>()

  if (lrampInstanceIds.length > 0) {
    // Load the LRAMP definition once from the database (not the seed file).
    const lrampDefinition = await loadFormDefinitionByCode("LRAMP")

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

    if (lrampDefinition) {
      for (const row of f1Rows) {
        if (!row.responseValue) continue
        const label = lrampShortDisposition(lrampDefinition.elements, {
          lramp_f1: [row.responseValue],
        })
        if (label) {
          scoreLabelByInstanceId.set(row.assessmentInstanceId, label)
        }
      }
    }
  }

  // MSE Score column shows the severity text ("Within limits" / "N noted").
  for (const row of results) {
    if (row.assessmentCode !== "mse") continue
    if (!row.severity?.trim()) continue
    scoreLabelByInstanceId.set(row.assessmentInstanceId, row.severity.trim())
  }

  return results.map((row) => ({
    assessmentResultId: row.assessmentResultId,
    assessmentDate: row.assessmentDate,
    score: row.score,
    severity: row.severity,
    acuteRiskRating: row.acuteRiskRating,
    assessmentCode: row.assessmentCode,
    assessmentName: row.assessmentName,
    scoreLabel: scoreLabelByInstanceId.get(row.assessmentInstanceId) ?? null,
  }))
}
