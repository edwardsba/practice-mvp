import { randomBytes } from "crypto"
import { and, eq } from "drizzle-orm"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  auditEvents,
  clients,
} from "@/db/schema"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"

export type CreateAssessmentLinkParams = {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  assessmentCode: string
  userId: string | null
}

export type CreateAssessmentLinkResult =
  | {
      ok: true
      link: string
      expiresAt: Date
      assessmentAccessLinkId: string
      clientEmail: string | null
      templateVariables: QuestionnaireEmailTemplateVariables
    }
  | { ok: false; error: string; status: number }

export async function createAssessmentLink(
  params: CreateAssessmentLinkParams
): Promise<CreateAssessmentLinkResult> {
  const { clientId, practiceId, practitionerProfileId, assessmentCode, userId } =
    params

  const [client] = await db
    .select({
      clientId: clients.clientId,
      email: clients.email,
      firstName: clients.firstName,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    return { ok: false, error: "Client not found.", status: 404 }
  }

  const emailContext = await getQuestionnaireEmailContext(
    practiceId,
    practitionerProfileId
  )
  if (!emailContext) {
    return {
      ok: false,
      error: "Practice or practitioner not found.",
      status: 404,
    }
  }

  const [definition] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentDefinitions)
    .where(
      and(
        eq(assessmentDefinitions.assessmentCode, assessmentCode),
        eq(assessmentDefinitions.isActive, true)
      )
    )
    .limit(1)

  if (!definition) {
    return {
      ok: false,
      error: "Assessment definition not found.",
      status: 404,
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (!appUrl) {
    return {
      ok: false,
      error: "Application URL is not configured.",
      status: 500,
    }
  }

  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashAssessmentToken(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  let accessLinkId: string

  try {
    await db.transaction(async (tx) => {
      const [instance] = await tx
        .insert(assessmentInstances)
        .values({
          assessmentDefinitionId: definition.assessmentDefinitionId,
          clientId,
          practiceId,
          practitionerProfileId,
          status: "assigned",
        })
        .returning({
          assessmentInstanceId: assessmentInstances.assessmentInstanceId,
        })

      const [link] = await tx
        .insert(assessmentAccessLinks)
        .values({
          assessmentInstanceId: instance.assessmentInstanceId,
          practiceId,
          clientId,
          tokenHash,
          expiresAt,
          accessStatus: "active",
        })
        .returning({
          assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
        })

      accessLinkId = link.assessmentAccessLinkId

      await tx.insert(auditEvents).values({
        practiceId,
        userId,
        clientId,
        eventType: "assessment_link.created",
        entityType: "assessment_access_link",
        entityId: link.assessmentAccessLinkId,
      })
    })
  } catch {
    return {
      ok: false,
      error: "Unable to create assessment link. Please try again.",
      status: 500,
    }
  }

  const linkUrl = `${appUrl}/q/${rawToken}`

  return {
    ok: true,
    link: linkUrl,
    expiresAt,
    assessmentAccessLinkId: accessLinkId!,
    clientEmail: client.email?.trim() || null,
    templateVariables: buildTemplateVariablesFromLinkResponse({
      clientFirstName: client.firstName,
      practiceName: emailContext.practiceName,
      practitionerName: emailContext.practitionerName,
      expiresAt,
    }),
  }
}
