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
import { loadFormDefinitionByCode } from "@/lib/assessments/load-form-definition"
import { usesSharedPractitionerForm } from "@/lib/assessments/practitioner-routes"
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
  if (
    !definition ||
    !usesSharedPractitionerForm({
      assessmentCode: definition.assessmentCode,
      clientCompletable: definition.clientCompletable,
      practitionerCompletable: definition.practitionerCompletable,
    })
  ) {
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

  // Gate on the instance's own definition (not only the posted code).
  const assessmentCode = String(formData.get("assessment_code") ?? "").trim()
  const definition = await loadFormDefinitionByCode(assessmentCode)
  if (
    !definition ||
    definition.assessmentDefinitionId !== instance.assessmentDefinitionId
  ) {
    return { error: "Assessment definition not found." }
  }
  if (
    !usesSharedPractitionerForm({
      assessmentCode: definition.assessmentCode,
      clientCompletable: definition.clientCompletable,
      practitionerCompletable: definition.practitionerCompletable,
    })
  ) {
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

    await tx
      .update(assessmentResults)
      .set({ assessmentDate })
      .where(eq(assessmentResults.assessmentInstanceId, instanceId))

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
