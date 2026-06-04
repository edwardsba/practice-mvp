import { randomBytes } from "crypto"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  auditEvents,
  clients,
} from "@/db/schema"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendQuestionnaireLinkEmail } from "@/lib/email/send-questionnaire-link"

type CreateLinkBody = {
  client_id?: string
  assessment_code?: string
  practitioner_profile_id?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: CreateLinkBody
  try {
    body = (await request.json()) as CreateLinkBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const clientId = body.client_id?.trim()
  const assessmentCode = body.assessment_code?.trim()
  const practitionerProfileId = body.practitioner_profile_id?.trim()

  if (!clientId || !assessmentCode || !practitionerProfileId) {
    return NextResponse.json(
      { error: "client_id, assessment_code, and practitioner_profile_id are required." },
      { status: 400 }
    )
  }

  if (practitionerProfileId !== context.practitionerProfileId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const practiceId = context.practiceId

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
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
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
    return NextResponse.json(
      { error: "Assessment definition not found." },
      { status: 404 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (!appUrl) {
    return NextResponse.json(
      { error: "Application URL is not configured." },
      { status: 500 }
    )
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
        .returning({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })

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
        userId: context.userId,
        clientId,
        eventType: "assessment_link.created",
        entityType: "assessment_access_link",
        entityId: link.assessmentAccessLinkId,
      })
    })
  } catch {
    return NextResponse.json(
      { error: "Unable to create assessment link. Please try again." },
      { status: 500 }
    )
  }

  const linkUrl = `${appUrl}/q/${rawToken}`
  const emailResult = await sendQuestionnaireLinkEmail({
    to: client.email,
    clientFirstName: client.firstName,
    linkUrl,
    expiresAt,
  })

  if (emailResult.sent) {
    await db.insert(auditEvents).values({
      practiceId,
      userId: context.userId,
      clientId,
      eventType: "email.sent",
      entityType: "assessment_access_link",
      entityId: accessLinkId!,
    })
  }

  return NextResponse.json({
    link: linkUrl,
    expires_at: expiresAt.toISOString(),
    emailSent: emailResult.sent,
    emailReason: emailResult.sent ? undefined : emailResult.reason,
    clientEmail: client.email?.trim() || null,
  })
}
