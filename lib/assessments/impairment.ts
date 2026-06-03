import { and, eq, inArray } from "drizzle-orm"

import {
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  assessmentResults,
} from "@/db/schema"
import { db } from "@/lib/db"

export const PHQ9_IMPAIRMENT_ELEMENT_KEY = "phq9_impairment"
export const GAD7_IMPAIRMENT_ELEMENT_KEY = "gad7_impairment"

export async function getFunctionalImpairmentLabelForResult(
  assessmentInstanceId: string,
  impairmentElementKey: string
): Promise<string | null> {
  const [row] = await db
    .select({ optionLabel: assessmentOptions.optionLabel })
    .from(assessmentResponses)
    .innerJoin(
      assessmentElements,
      eq(
        assessmentResponses.assessmentElementId,
        assessmentElements.assessmentElementId
      )
    )
    .innerJoin(
      assessmentOptions,
      and(
        eq(
          assessmentOptions.assessmentElementId,
          assessmentResponses.assessmentElementId
        ),
        eq(assessmentOptions.optionValue, assessmentResponses.responseValue)
      )
    )
    .where(
      and(
        eq(assessmentResponses.assessmentInstanceId, assessmentInstanceId),
        eq(assessmentElements.elementKey, impairmentElementKey)
      )
    )
    .limit(1)

  return row?.optionLabel ?? null
}

export async function getFunctionalImpairmentLabelsByResultId(
  assessmentResultIds: string[],
  impairmentElementKey: string
): Promise<Map<string, string>> {
  if (assessmentResultIds.length === 0) return new Map()

  const rows = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      optionLabel: assessmentOptions.optionLabel,
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
      assessmentResponses,
      eq(
        assessmentResponses.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentElements,
      eq(
        assessmentResponses.assessmentElementId,
        assessmentElements.assessmentElementId
      )
    )
    .innerJoin(
      assessmentOptions,
      and(
        eq(
          assessmentOptions.assessmentElementId,
          assessmentResponses.assessmentElementId
        ),
        eq(assessmentOptions.optionValue, assessmentResponses.responseValue)
      )
    )
    .where(
      and(
        inArray(assessmentResults.assessmentResultId, assessmentResultIds),
        eq(assessmentElements.elementKey, impairmentElementKey)
      )
    )

  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.optionLabel) {
      map.set(row.assessmentResultId, row.optionLabel)
    }
  }
  return map
}
