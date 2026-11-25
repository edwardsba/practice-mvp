"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
  auditEvents,
  clients,
} from "@/db/schema"
import {
  toResponseRows,
  validateAnswers,
  type FormAnswers,
} from "@/lib/assessments/form-rules"
import { instanceHasAccessLink } from "@/lib/assessments/instance-access-link"
import { loadFormDefinitionByCode } from "@/lib/assessments/load-form-definition"
import { canCompleteInSharedForm } from "@/lib/assessments/practitioner-routes"
import { scoreAssessment } from "@/lib/assessments/scoring/score-assessment"
import { requirePractitionerContext } from "@/lib/auth"
import { practiceLocalToUtc } from "@/lib/dates/practice-time"
import { db } from "@/lib/db"
import { safeReturnTo } from "@/lib/navigation/safe-return-to"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

export type SavePractitionerAssessmentState = {
  error?: string
  fieldErrors?: Array<{ elementKey: string; message: string }>
}

function parseAnswersJson(raw: string): FormAnswers | null {
  try {
    const parsed = JSON.parse(raw) as FormAnswers
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

function assessmentDateFromInput(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [year, month, day] = dateStr.split("-").map(Number)
  return practiceLocalToUtc(new Date(year, month - 1, day, 12, 0, 0, 0))
}

async function assertClientInPractice(clientId: string, practiceId: string) {
  const [client] = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)
  return Boolean(client)
}

function sharedFormGate(definition: {
  assessmentCode: string
  clientCompletable: boolean
  practitionerCompletable: boolean
  isActive: boolean
  elements: unknown[]
}) {
  return canCompleteInSharedForm({
    assessmentCode: definition.assessmentCode,
    clientCompletable: definition.clientCompletable,
    practitionerCompletable: definition.practitionerCompletable,
    isActive: definition.isActive,
    hasActiveElements: definition.elements.length > 0,
  })
}

export async function saveNewPractitionerAssessment(
  clientId: string,
  assessmentCode: string,
  _prev: SavePractitionerAssessmentState,
  formData: FormData
): Promise<SavePractitionerAssessmentState> {
  const context = await requirePractitionerContext()

  if (!(await assertClientInPractice(clientId, context.practiceId))) {
    return { error: "Client not found." }
  }

  const sessionNoteIdRaw = String(formData.get("session_note_id") ?? "").trim()
  const sessionNoteId = sessionNoteIdRaw || null
  if (sessionNoteId) {
    const note = await loadSessionNoteForPractice(
      sessionNoteId,
      context.practiceId
    )
    if (!note || note.clientId !== clientId) {
      return { error: "Session note not found for this client." }
    }
  }

  const definition = await loadFormDefinitionByCode(assessmentCode)
  if (!definition || !sharedFormGate(definition)) {
    return { error: "Assessment definition not found." }
  }

  const answers = parseAnswersJson(String(formData.get("answers_json") ?? ""))
  if (!answers) {
    return { error: "Invalid answers payload." }
  }

  const assessmentDateRaw = String(formData.get("assessment_date") ?? "").trim()
  const assessmentDate = assessmentDateFromInput(assessmentDateRaw)
  if (!assessmentDate) {
    return { error: "A valid date of assessment is required." }
  }

  const fieldErrors = validateAnswers(definition.elements, answers)
  if (fieldErrors.length > 0) {
    return {
      error: `${fieldErrors.length} question${fieldErrors.length === 1 ? "" : "s"} still need an answer`,
      fieldErrors,
    }
  }

  const rows = toResponseRows(definition.elements, answers)
  const now = new Date()
  const returnTo =
    safeReturnTo(String(formData.get("return_to") ?? "")) ??
    `/clients/${clientId}/assessments`

  const scored = definition.scoringEnabled
    ? scoreAssessment({
        assessmentCode: definition.assessmentCode,
        responses: rows.map((row) => {
          const meta = definition.elementScoreMetaByKey[row.elementKey]
          return {
            elementKey: row.elementKey,
            domainCode: meta?.domainCode ?? null,
            dataType: meta?.dataType ?? "integer",
            scoreValue: row.scoreValue,
            responseValue: row.responseValue,
          }
        }),
      })
    : null

  await db.transaction(async (tx) => {
    const [instance] = await tx
      .insert(assessmentInstances)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        clientId,
        practiceId: context.practiceId,
        practitionerProfileId: context.practitionerProfileId,
        sessionNoteId,
        status: "submitted",
        submittedAt: now,
      })
      .returning({
        assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      })

    if (rows.length > 0) {
      await tx.insert(assessmentResponses).values(
        rows.map((row) => {
          const elementId = definition.elementIdByKey[row.elementKey]
          if (!elementId) {
            throw new Error(`Missing element id for ${row.elementKey}`)
          }
          return {
            assessmentInstanceId: instance.assessmentInstanceId,
            assessmentElementId: elementId,
            clientId,
            practiceId: context.practiceId,
            responseValue: row.responseValue,
            scoreValue: row.scoreValue,
            responseOrder: row.responseOrder,
          }
        })
      )
    }

    if (scored) {
      // Same result columns + default status ("scored") as the client submit route.
      const [result] = await tx
        .insert(assessmentResults)
        .values({
          assessmentInstanceId: instance.assessmentInstanceId,
          clientId,
          practiceId: context.practiceId,
          score: scored.score,
          severity: scored.severity,
          structuredScoreJson: scored.structuredScoreJson,
          assessmentDate,
        })
        .returning({
          assessmentResultId: assessmentResults.assessmentResultId,
        })

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
    } else {
      // Unscored practitioner-only (LRAMP): status completed, no numeric score.
      await tx.insert(assessmentResults).values({
        assessmentInstanceId: instance.assessmentInstanceId,
        clientId,
        practiceId: context.practiceId,
        score: null,
        severity: null,
        status: "completed",
        assessmentDate,
      })

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId,
        eventType: "assessment.submitted",
        entityType: "assessment_instance",
        entityId: instance.assessmentInstanceId,
      })
    }
  })

  redirect(returnTo)
}

export async function saveEditPractitionerAssessment(
  clientId: string,
  instanceId: string,
  _prev: SavePractitionerAssessmentState,
  formData: FormData
): Promise<SavePractitionerAssessmentState> {
  const context = await requirePractitionerContext()

  if (!(await assertClientInPractice(clientId, context.practiceId))) {
    return { error: "Client not found." }
  }

  const [instance] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      clientId: assessmentInstances.clientId,
      practiceId: assessmentInstances.practiceId,
    })
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
    return { error: "Assessment instance not found." }
  }

  // Clients' own answers must never be edited.
  if (await instanceHasAccessLink(instanceId)) {
    return {
      error: "This assessment was completed by the client and cannot be edited.",
    }
  }

  // Gate on the instance's own definition (not only the posted code).
  const assessmentCode = String(formData.get("assessment_code") ?? "").trim()
  const definition = await loadFormDefinitionByCode(assessmentCode)
  if (
    !definition ||
    definition.assessmentDefinitionId !== instance.assessmentDefinitionId
  ) {
    return { error: "Assessment definition not found." }
  }
  if (!sharedFormGate(definition)) {
    return { error: "This assessment cannot be edited with the shared form." }
  }

  const answers = parseAnswersJson(String(formData.get("answers_json") ?? ""))
  if (!answers) {
    return { error: "Invalid answers payload." }
  }

  const assessmentDateRaw = String(formData.get("assessment_date") ?? "").trim()
  const assessmentDate = assessmentDateFromInput(assessmentDateRaw)
  if (!assessmentDate) {
    return { error: "A valid date of assessment is required." }
  }

  const fieldErrors = validateAnswers(definition.elements, answers)
  if (fieldErrors.length > 0) {
    return {
      error: `${fieldErrors.length} question${fieldErrors.length === 1 ? "" : "s"} still need an answer`,
      fieldErrors,
    }
  }

  const rows = toResponseRows(definition.elements, answers)
  const now = new Date()
  const returnTo =
    safeReturnTo(String(formData.get("return_to") ?? "")) ??
    `/clients/${clientId}/assessments`

  const scored = definition.scoringEnabled
    ? scoreAssessment({
        assessmentCode: definition.assessmentCode,
        responses: rows.map((row) => {
          const meta = definition.elementScoreMetaByKey[row.elementKey]
          return {
            elementKey: row.elementKey,
            domainCode: meta?.domainCode ?? null,
            dataType: meta?.dataType ?? "integer",
            scoreValue: row.scoreValue,
            responseValue: row.responseValue,
          }
        }),
      })
    : null

  await db.transaction(async (tx) => {
    await tx
      .delete(assessmentResponses)
      .where(eq(assessmentResponses.assessmentInstanceId, instanceId))

    if (rows.length > 0) {
      await tx.insert(assessmentResponses).values(
        rows.map((row) => {
          const elementId = definition.elementIdByKey[row.elementKey]
          if (!elementId) {
            throw new Error(`Missing element id for ${row.elementKey}`)
          }
          return {
            assessmentInstanceId: instanceId,
            assessmentElementId: elementId,
            clientId,
            practiceId: context.practiceId,
            responseValue: row.responseValue,
            scoreValue: row.scoreValue,
            responseOrder: row.responseOrder,
          }
        })
      )
    }

    if (scored) {
      await tx
        .update(assessmentResults)
        .set({
          score: scored.score,
          severity: scored.severity,
          structuredScoreJson: scored.structuredScoreJson,
          assessmentDate,
        })
        .where(eq(assessmentResults.assessmentInstanceId, instanceId))
    } else {
      await tx
        .update(assessmentResults)
        .set({ assessmentDate })
        .where(eq(assessmentResults.assessmentInstanceId, instanceId))
    }

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

  redirect(returnTo)
}
