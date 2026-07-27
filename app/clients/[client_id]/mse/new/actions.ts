"use server"

import { and, eq, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  auditEvents,
  clients,
} from "@/db/schema"
import { getMseDefinitionId } from "@/lib/assessments/load-mse"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

export type SaveMseResultState = {
  error?: string
}

export async function saveMseResult(
  clientId: string,
  _prevState: SaveMseResultState,
  formData: FormData
): Promise<SaveMseResultState> {
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
  const returnToRaw = String(formData.get("returnTo") ?? "").trim()
  const returnTo = returnToRaw || null

  if (sessionNoteId) {
    const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
    if (!note || note.clientId !== clientId) {
      return { error: "Session note not found for this client." }
    }
  }

  const definitionId = await getMseDefinitionId()
  if (!definitionId) {
    return { error: "MSE is not configured. Run the MSE seed script." }
  }

  const elements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
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
    const value = String(
      formData.get(`response_${element.assessmentElementId}`) ?? ""
    ).trim()
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
  }

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

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "assessment.submitted",
      entityType: "assessment_instance",
      entityId: instance.assessmentInstanceId,
    })
  })

  if (returnTo) {
    redirect(returnTo)
  }
  redirect(sessionNoteId ? `/session-notes/${sessionNoteId}` : `/clients/${clientId}`)
}

export type UpdateMseResultState = {
  error?: string
}

export async function updateMseResult(
  clientId: string,
  instanceId: string,
  _prevState: UpdateMseResultState,
  formData: FormData
): Promise<UpdateMseResultState> {
  const context = await requirePractitionerContext()

  const [instance] = await db
    .select({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })
    .from(assessmentInstances)
    .where(
      and(
        eq(assessmentInstances.assessmentInstanceId, instanceId),
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentInstances.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!instance) {
    return { error: "MSE not found." }
  }

  const returnToRaw = String(formData.get("returnTo") ?? "").trim()
  const returnTo = returnToRaw || null

  const definitionId = await getMseDefinitionId()
  if (!definitionId) {
    return { error: "MSE is not configured. Run the MSE seed script." }
  }

  const elements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
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
    const value = String(
      formData.get(`response_${element.assessmentElementId}`) ?? ""
    ).trim()
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
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .delete(assessmentResponses)
      .where(eq(assessmentResponses.assessmentInstanceId, instanceId))

    await tx.insert(assessmentResponses).values(
      responseRows.map((row) => ({
        assessmentInstanceId: instanceId,
        assessmentElementId: row.assessmentElementId,
        clientId,
        practiceId: context.practiceId,
        responseValue: row.responseValue,
        scoreValue: row.scoreValue,
      }))
    )

    await tx
      .update(assessmentInstances)
      .set({ updatedAt: now })
      .where(eq(assessmentInstances.assessmentInstanceId, instanceId))

    await tx.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId,
      eventType: "assessment.updated",
      entityType: "assessment_instance",
      entityId: instanceId,
    })
  })

  redirect(returnTo || `/clients/${clientId}/mse/${instanceId}`)
}
