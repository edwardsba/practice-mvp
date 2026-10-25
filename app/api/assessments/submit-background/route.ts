import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
  auditEvents,
} from "@/db/schema"
import { sanitizeBackgroundAnswers } from "@/lib/background-questionnaire/answers"
import { BACKGROUND_ASSESSMENT_CODE } from "@/lib/background-questionnaire/types"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

type SubmitBody = {
  token?: string
  answers?: unknown
}

function isLinkSubmittable(accessStatus: string, expiresAt: Date) {
  return accessStatus === "active" && expiresAt.getTime() > Date.now()
}

export async function POST(request: Request) {
  let body: SubmitBody
  try {
    body = (await request.json()) as SubmitBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const rawToken = body.token?.trim()
  if (!rawToken) {
    return NextResponse.json({ error: "token is required." }, { status: 400 })
  }

  const tokenHash = hashAssessmentToken(rawToken)

  const [accessLink] = await db
    .select()
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, tokenHash))
    .limit(1)

  if (!accessLink || !isLinkSubmittable(accessLink.accessStatus, accessLink.expiresAt)) {
    return NextResponse.json({ error: "This link is no longer valid." }, { status: 400 })
  }

  const [instance] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      clientId: assessmentInstances.clientId,
      practiceId: assessmentInstances.practiceId,
    })
    .from(assessmentInstances)
    .where(eq(assessmentInstances.assessmentInstanceId, accessLink.assessmentInstanceId))
    .limit(1)

  if (!instance) {
    return NextResponse.json({ error: "This link is no longer valid." }, { status: 400 })
  }

  const [definition] = await db
    .select({ assessmentCode: assessmentDefinitions.assessmentCode })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentDefinitionId, instance.assessmentDefinitionId))
    .limit(1)

  if (!definition || definition.assessmentCode !== BACKGROUND_ASSESSMENT_CODE) {
    return NextResponse.json({ error: "This link is no longer valid." }, { status: 400 })
  }

  const answers = sanitizeBackgroundAnswers(body.answers)
  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(assessmentInstances)
        .set({
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(assessmentInstances.assessmentInstanceId, instance.assessmentInstanceId))

      await tx
        .update(assessmentAccessLinks)
        .set({
          accessStatus: "submitted",
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(assessmentAccessLinks.assessmentAccessLinkId, accessLink.assessmentAccessLinkId))

      const [result] = await tx
        .insert(assessmentResults)
        .values({
          assessmentInstanceId: instance.assessmentInstanceId,
          clientId: instance.clientId,
          practiceId: instance.practiceId,
          score: null,
          severity: null,
          structuredScoreJson: answers,
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
