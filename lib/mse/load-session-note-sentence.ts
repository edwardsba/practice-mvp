import { and, eq } from "drizzle-orm"

import {
  assessmentElements,
  assessmentOptions,
  assessmentResponses,
} from "@/db/schema"
import { db } from "@/lib/db"
import {
  buildMseSessionNoteSentence,
  MSE_ELEMENT_KEY_TO_FIELD,
  type MseSessionNoteResponses,
} from "@/lib/mse/session-note-sentence"

export async function loadMseSessionNoteSentence(
  assessmentInstanceId: string
): Promise<string | null> {
  const rows = await db
    .select({
      elementKey: assessmentElements.elementKey,
      optionLabel: assessmentOptions.optionLabel,
      isReportingBaseline: assessmentOptions.isReportingBaseline,
    })
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
    .where(eq(assessmentResponses.assessmentInstanceId, assessmentInstanceId))

  if (rows.length === 0) return null

  const responses: MseSessionNoteResponses = {}
  for (const row of rows) {
    const fieldKey = MSE_ELEMENT_KEY_TO_FIELD[row.elementKey]
    if (!fieldKey) continue // skips mse_suicidality and unknown keys
    responses[fieldKey] = {
      optionLabel: row.optionLabel,
      isReportingBaseline: row.isReportingBaseline,
    }
  }

  const sentence = buildMseSessionNoteSentence(responses)
  return sentence.trim() ? sentence : null
}
