import { randomBytes } from "crypto"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  auditEvents,
  batteryInstances,
  clients,
} from "@/db/schema"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"

type CreateBatteryBody = {
  client_id?: string
  practitioner_profile_id?: string
}

const BATTERY_CODE = "PRE_SESSION"
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: CreateBatteryBody
  try {
    body = (await request.json()) as CreateBatteryBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const clientId = body.client_id?.trim()
  const practitionerProfileId = body.practitioner_profile_id?.trim()

  if (!clientId || !practitionerProfileId) {
    return NextResponse.json(
      { error: "client_id and practitioner_profile_id are required." },
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

  const emailContext = await getQuestionnaireEmailContext(
    practiceId,
    practitionerProfileId
  )
  if (!emailContext) {
    return NextResponse.json(
      { error: "Practice or practitioner not found." },
      { status: 404 }
    )
  }

  const definitions = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
      assessmentCode: assessmentDefinitions.assessmentCode,
    })
    .from(assessmentDefinitions)
    .where(and(eq(assessmentDefinitions.isActive, true)))

  const phq9Definition = definitions.find((d) => d.assessmentCode === "PHQ9")
  const gad7Definition = definitions.find((d) => d.assessmentCode === "GAD7")

  if (!phq9Definition || !gad7Definition) {
    return NextResponse.json(
      { error: "PHQ-9 or GAD-7 assessment definitions are not available." },
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

  const phq9RawToken = randomBytes(32).toString("hex")
  const gad7RawToken = randomBytes(32).toString("hex")
  const phq9TokenHash = hashAssessmentToken(phq9RawToken)
  const gad7TokenHash = hashAssessmentToken(gad7RawToken)
  const expiresAt = new Date(Date.now() + LINK_TTL_MS)

  let phq9AccessLinkId: string

  try {
    await db.transaction(async (tx) => {
      const [phq9Instance] = await tx
        .insert(assessmentInstances)
        .values({
          assessmentDefinitionId: phq9Definition.assessmentDefinitionId,
          clientId,
          practiceId,
          practitionerProfileId,
          status: "assigned",
        })
        .returning({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })

      const [gad7Instance] = await tx
        .insert(assessmentInstances)
        .values({
          assessmentDefinitionId: gad7Definition.assessmentDefinitionId,
          clientId,
          practiceId,
          practitionerProfileId,
          status: "assigned",
        })
        .returning({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })

      const [phq9Link] = await tx
        .insert(assessmentAccessLinks)
        .values({
          assessmentInstanceId: phq9Instance.assessmentInstanceId,
          practiceId,
          clientId,
          tokenHash: phq9TokenHash,
          expiresAt,
          accessStatus: "active",
        })
        .returning({
          assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
        })

      const [gad7Link] = await tx
        .insert(assessmentAccessLinks)
        .values({
          assessmentInstanceId: gad7Instance.assessmentInstanceId,
          practiceId,
          clientId,
          tokenHash: gad7TokenHash,
          expiresAt,
          accessStatus: "active",
        })
        .returning({
          assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
        })

      phq9AccessLinkId = phq9Link.assessmentAccessLinkId

      const [battery] = await tx
        .insert(batteryInstances)
        .values({
          practiceId,
          clientId,
          practitionerProfileId,
          batteryCode: BATTERY_CODE,
          phq9InstanceId: phq9Instance.assessmentInstanceId,
          gad7InstanceId: gad7Instance.assessmentInstanceId,
          phq9LinkId: phq9Link.assessmentAccessLinkId,
          gad7LinkId: gad7Link.assessmentAccessLinkId,
          status: "assigned",
        })
        .returning({ batteryInstanceId: batteryInstances.batteryInstanceId })

      await tx.insert(auditEvents).values({
        practiceId,
        userId: context.userId,
        clientId,
        eventType: "battery.created",
        entityType: "battery_instance",
        entityId: battery.batteryInstanceId,
      })
    })
  } catch {
    return NextResponse.json(
      { error: "Unable to create pre-session questionnaire link. Please try again." },
      { status: 500 }
    )
  }

  const linkUrl = `${appUrl}/q/${phq9RawToken}?battery=${encodeURIComponent(gad7RawToken)}`

  return NextResponse.json({
    link: linkUrl,
    expires_at: expiresAt.toISOString(),
    assessmentAccessLinkId: phq9AccessLinkId!,
    clientEmail: client.email?.trim() || null,
    templateVariables: buildTemplateVariablesFromLinkResponse({
      clientFirstName: client.firstName,
      practiceName: emailContext.practiceName,
      practitionerName: emailContext.practitionerName,
      expiresAt,
    }),
  })
}
