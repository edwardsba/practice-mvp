import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
  auditEvents,
} from "@/db/schema"
import type { FormAnswers } from "@/lib/assessments/form-rules"
import { loadFormDefinitionByCode } from "@/lib/assessments/load-form-definition"
import { definitionUsesSharedClientForm } from "@/lib/assessments/needs-shared-client-form"
import { scoreAssessment } from "@/lib/assessments/scoring/score-assessment"
import { prepareClientFormSubmission } from "@/lib/assessments/submit-client-form"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

type SubmitFormBody = {
  token?: string
  answers?: FormAnswers
}

function isLinkSubmittable(accessStatus: string, expiresAt: Date) {
  return accessStatus === "active" && expiresAt.getTime() > Date.now()
}

function parseAnswers(value: unknown): FormAnswers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const answers: FormAnswers = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== "string" || !key.trim()) continue
    if (!Array.isArray(raw)) continue
    if (!raw.every((item) => typeof item === "string")) continue
    answers[key] = raw as string[]
  }
  return answers
}

export async function POST(request: Request) {
  let body: SubmitFormBody
  try {
    body = (await request.json()) as SubmitFormBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const rawToken = body.token?.trim()
  const answers = parseAnswers(body.answers)

  if (!rawToken || !answers) {
    return NextResponse.json(
      { error: "token and answers are required." },
      { status: 400 }
    )
  }

  const tokenHash = hashAssessmentToken(rawToken)

  const [accessLink] = await db
    .select()
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, tokenHash))
    .limit(1)

  if (!accessLink) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
  }

  // Shared-form client path: first submit only (thank-you; link cannot be reused).
  if (!isLinkSubmittable(accessLink.accessStatus, accessLink.expiresAt)) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
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
      eq(assessmentInstances.assessmentInstanceId, accessLink.assessmentInstanceId)
    )
    .limit(1)

  if (!instance) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
  }

  const [definitionMeta] = await db
    .select({ assessmentCode: assessmentDefinitions.assessmentCode })
    .from(assessmentDefinitions)
    .where(
      eq(
        assessmentDefinitions.assessmentDefinitionId,
        instance.assessmentDefinitionId
      )
    )
    .limit(1)

  if (!definitionMeta) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
  }

  const definition = await loadFormDefinitionByCode(definitionMeta.assessmentCode)
  if (!definition || !definitionUsesSharedClientForm(definition.elements)) {
    return NextResponse.json(
      { error: "This questionnaire cannot be submitted here." },
      { status: 400 }
    )
  }

  const prepared = prepareClientFormSubmission(definition.elements, answers)
  if (!prepared.ok) {
    return NextResponse.json(
      {
        error:
          prepared.errors[0]?.message ??
          "Please check your answers before submitting.",
        fieldErrors: prepared.errors,
      },
      { status: 400 }
    )
  }

  // Map by elementKey against the server definition — never trust browser IDs.
  if (
    prepared.rows.some((row) => !definition.elementIdByKey[row.elementKey])
  ) {
    return NextResponse.json(
      { error: "One or more responses are invalid." },
      { status: 400 }
    )
  }

  const responseValues = prepared.rows.map((row) => {
    const elementId = definition.elementIdByKey[row.elementKey]!
    const meta = definition.elementScoreMetaByKey[row.elementKey]
    return {
      assessmentElementId: elementId,
      elementKey: row.elementKey,
      domainCode: meta?.domainCode ?? null,
      dataType: meta?.dataType ?? "text",
      responseValue: row.responseValue,
      scoreValue: row.scoreValue,
      responseOrder: row.responseOrder,
    }
  })

  const scored = scoreAssessment({
    assessmentCode: definition.assessmentCode,
    responses: responseValues.map((row) => ({
      assessmentElementId: row.assessmentElementId,
      elementKey: row.elementKey,
      domainCode: row.domainCode,
      dataType: row.dataType,
      scoreValue: row.scoreValue,
      responseValue: row.responseValue,
    })),
  })

  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      if (responseValues.length > 0) {
        await tx.insert(assessmentResponses).values(
          responseValues.map((row) => ({
            assessmentInstanceId: instance.assessmentInstanceId,
            assessmentElementId: row.assessmentElementId,
            clientId: instance.clientId,
            practiceId: instance.practiceId,
            responseValue: row.responseValue,
            scoreValue: row.scoreValue,
            responseOrder: row.responseOrder,
          }))
        )
      }

      await tx
        .update(assessmentInstances)
        .set({
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        })
        .where(
          eq(
            assessmentInstances.assessmentInstanceId,
            instance.assessmentInstanceId
          )
        )

      await tx
        .update(assessmentAccessLinks)
        .set({
          accessStatus: "submitted",
          submittedAt: now,
          updatedAt: now,
        })
        .where(
          eq(
            assessmentAccessLinks.assessmentAccessLinkId,
            accessLink.assessmentAccessLinkId
          )
        )

      const [result] = await tx
        .insert(assessmentResults)
        .values({
          assessmentInstanceId: instance.assessmentInstanceId,
          clientId: instance.clientId,
          practiceId: instance.practiceId,
          score: scored.score,
          severity: scored.severity,
          structuredScoreJson: scored.structuredScoreJson,
          assessmentDate: now,
        })
        .returning({ assessmentResultId: assessmentResults.assessmentResultId })

      await tx.insert(auditEvents).values({
        practiceId: instance.practiceId,
        clientId: instance.clientId,
        eventType: "assessment.submitted",
        entityType: "assessment_instance",
        entityId: instance.assessmentInstanceId,
      })

      await tx.insert(auditEvents).values({
        practiceId: instance.practiceId,
        clientId: instance.clientId,
        eventType: "assessment_result.scored",
        entityType: "assessment_result",
        entityId: result.assessmentResultId,
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Unable to submit your responses. Please try again." },
      { status: 500 }
    )
  }
}
