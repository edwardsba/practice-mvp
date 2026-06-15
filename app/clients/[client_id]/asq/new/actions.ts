"use server"

import { and, eq, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  assessmentResults,
  auditEvents,
  clients,
} from "@/db/schema"
import {
  ASQ_Q5_ELEMENT_KEY,
  asqAcuteRiskRating,
  asqScreenOutcome,
} from "@/lib/assessments/asq"
import { getAsqDefinitionId } from "@/lib/assessments/load-asq"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

export type SaveAsqResultState = {
  error?: string
}

export async function saveAsqResult(
  clientId: string,
  _prevState: SaveAsqResultState,
  formData: FormData
): Promise<SaveAsqResultState> {
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    return { error: "Client not found." }
  }

  const sessionNoteIdRaw = String(formData.get("session_note_id") ?? "").trim()
  const sessionNoteId = sessionNoteIdRaw || null

  if (sessionNoteId) {
    const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
    if (!note || note.clientId !== clientId) {
      return { error: "Session note not found for this client." }
    }
  }

  const definitionId = await getAsqDefinitionId()
  if (!definitionId) {
    return { error: "ASQ is not configured. Run the ASQ seed script." }
  }

  const elements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
      dataType: assessmentElements.dataType,
    })
    .from(assessmentElements)
    .where(
      and(
        eq(assessmentElements.assessmentDefinitionId, definitionId),
        eq(assessmentElements.isActive, true)
      )
    )

  const responses: Record<string, string> = {}
  for (const element of elements) {
    const value = String(formData.get(`response_${element.assessmentElementId}`) ?? "").trim()
    if (!value) {
      return { error: "Please answer all questions before submitting." }
    }
    responses[element.assessmentElementId] = value
  }

  const elementIds = Object.keys(responses)
  const optionRows = await db
    .select({
      assessmentElementId: assessmentOptions.assessmentElementId,
      optionValue: assessmentOptions.optionValue,
      scoreValue: assessmentOptions.scoreValue,
    })
    .from(assessmentOptions)
    .where(
      and(
        eq(assessmentOptions.assessmentDefinitionId, definitionId),
        inArray(assessmentOptions.assessmentElementId, elementIds)
      )
    )

  const scoreByElementAndValue = new Map<string, number>()
  for (const row of optionRows) {
    scoreByElementAndValue.set(
      `${row.assessmentElementId}:${row.optionValue}`,
      row.scoreValue
    )
  }

  const dataTypeByElementId = new Map(
    elements.map((e) => [e.assessmentElementId, e.dataType])
  )
  const elementKeyById = new Map(
    elements.map((e) => [e.assessmentElementId, e.elementKey])
  )

  let totalScore = 0
  let q5ResponseValue = "no"
  const responseRows: {
    assessmentElementId: string
    responseValue: string
    scoreValue: number
  }[] = []

  for (const elementId of elementIds) {
    const responseValue = responses[elementId]
    const scoreValue = scoreByElementAndValue.get(`${elementId}:${responseValue}`)
    if (scoreValue === undefined) {
      return { error: "One or more responses are invalid." }
    }

    responseRows.push({
      assessmentElementId: elementId,
      responseValue,
      scoreValue,
    })

    if (dataTypeByElementId.get(elementId) === "integer") {
      totalScore += scoreValue
    }

    if (elementKeyById.get(elementId) === ASQ_Q5_ELEMENT_KEY) {
      q5ResponseValue = responseValue
    }
  }

  const severity = asqScreenOutcome(totalScore, q5ResponseValue)
  const acuteRiskRating = asqAcuteRiskRating(q5ResponseValue)
  const now = new Date()

  await db.transaction(async (tx) => {
    const [instance] = await tx
      .insert(assessmentInstances)
      .values({
        assessmentDefinitionId: definitionId,
        clientId,
        practiceId: context.practiceId,
        practitionerProfileId: context.practitionerProfileId,
        sessionNoteId,
        status: "submitted",
        submittedAt: now,
      })
      .returning({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })

    await tx.insert(assessmentResponses).values(
      responseRows.map((row) => ({
        assessmentInstanceId: instance.assessmentInstanceId,
        assessmentElementId: row.assessmentElementId,
        clientId,
        practiceId: context.practiceId,
        responseValue: row.responseValue,
        scoreValue: row.scoreValue,
      }))
    )

    const [result] = await tx
      .insert(assessmentResults)
      .values({
        assessmentInstanceId: instance.assessmentInstanceId,
        clientId,
        practiceId: context.practiceId,
        score: totalScore,
        severity,
        acuteRiskRating,
        assessmentDate: now,
      })
      .returning({ assessmentResultId: assessmentResults.assessmentResultId })

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "assessment.submitted",
      entityType: "assessment_instance",
      entityId: instance.assessmentInstanceId,
    })

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "assessment_result.scored",
      entityType: "assessment_result",
      entityId: result.assessmentResultId,
    })
  })

  redirect(sessionNoteId ? `/session-notes/${sessionNoteId}` : `/clients/${clientId}`)
}
