import { and, asc, eq } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
} from "@/db/schema"
import {
  answersFromResponseRows,
  type FormAnswers,
} from "@/lib/assessments/form-rules"
import { formatDateForInput } from "@/lib/dates/practice-time"
import { db } from "@/lib/db"

export type LoadedAssessmentInstance = {
  assessmentInstanceId: string
  assessmentCode: string
  clientId: string
  practiceId: string
  sessionNoteId: string | null
  answers: FormAnswers
  assessmentDate: string
}

export async function loadAssessmentInstanceForForm(params: {
  instanceId: string
  clientId: string
  practiceId: string
}): Promise<LoadedAssessmentInstance | null> {
  const [instance] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      clientId: assessmentInstances.clientId,
      practiceId: assessmentInstances.practiceId,
      sessionNoteId: assessmentInstances.sessionNoteId,
      assessmentCode: assessmentDefinitions.assessmentCode,
    })
    .from(assessmentInstances)
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentInstances.assessmentInstanceId, params.instanceId),
        eq(assessmentInstances.clientId, params.clientId),
        eq(assessmentInstances.practiceId, params.practiceId)
      )
    )
    .limit(1)

  if (!instance) return null

  const [result] = await db
    .select({ assessmentDate: assessmentResults.assessmentDate })
    .from(assessmentResults)
    .where(
      eq(
        assessmentResults.assessmentInstanceId,
        instance.assessmentInstanceId
      )
    )
    .limit(1)

  const responseRows = await db
    .select({
      elementKey: assessmentElements.elementKey,
      responseValue: assessmentResponses.responseValue,
      responseOrder: assessmentResponses.responseOrder,
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
      eq(
        assessmentResponses.assessmentInstanceId,
        instance.assessmentInstanceId
      )
    )
    .orderBy(
      asc(assessmentElements.displayOrder),
      asc(assessmentResponses.responseOrder)
    )

  return {
    assessmentInstanceId: instance.assessmentInstanceId,
    assessmentCode: instance.assessmentCode,
    clientId: instance.clientId,
    practiceId: instance.practiceId,
    sessionNoteId: instance.sessionNoteId,
    answers: answersFromResponseRows(responseRows),
    assessmentDate: formatDateForInput(
      result?.assessmentDate
        ? result.assessmentDate.toISOString()
        : null
    ),
  }
}
