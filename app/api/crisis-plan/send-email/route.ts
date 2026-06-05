import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { auditEvents, crisisPlans } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateAndStoreCrisisPlanPdf } from "@/lib/crisis-plan/generate-pdf"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import {
  resolveCrisisPlanEmail,
  type CrisisPlanEmailVariables,
} from "@/lib/email/crisis-plan-templates"
import { sendCrisisPlanEmail } from "@/lib/email/send-crisis-plan-email"
import {
  loadEmergencyContacts,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import { rowToCrisisPlan } from "@/lib/crisis-plans/serialize"

type SendCrisisPlanEmailBody = {
  to?: string
  subject?: string
  message?: string
  crisisPlanId?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: SendCrisisPlanEmailBody
  try {
    body = (await request.json()) as SendCrisisPlanEmailBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const to = body.to?.trim()
  const subject = body.subject?.trim()
  const message = body.message?.trim()
  const crisisPlanId = body.crisisPlanId?.trim()

  if (!to || !subject || !message || !crisisPlanId) {
    return NextResponse.json(
      { error: "to, subject, message, and crisisPlanId are required." },
      { status: 400 }
    )
  }

  const [row] = await db
    .select()
    .from(crisisPlans)
    .where(
      and(
        eq(crisisPlans.crisisPlanId, crisisPlanId),
        eq(crisisPlans.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Crisis plan not found." }, { status: 404 })
  }

  const plan = rowToCrisisPlan(row)
  const client = await verifyClientInPractice(plan.clientId, context.practiceId)
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const emailContext = await getQuestionnaireEmailContext(
    context.practiceId,
    context.practitionerProfileId
  )
  if (!emailContext) {
    return NextResponse.json(
      { error: "Practice or practitioner not found." },
      { status: 404 }
    )
  }

  const variables: CrisisPlanEmailVariables = {
    client_first_name: client.firstName.trim() || "there",
    practice_name: emailContext.practiceName,
    practitioner_name: emailContext.practitionerName,
  }

  const contacts = await loadEmergencyContacts(plan.clientId, context.practiceId)
  const clientName = `${client.firstName} ${client.lastName}`

  try {
    const { pdfBuffer } = await generateAndStoreCrisisPlanPdf({
      plan,
      contacts,
      clientName,
    })

    const { subject: resolvedSubject, htmlBody, textBody } =
      resolveCrisisPlanEmail(subject, message, variables)

    const result = await sendCrisisPlanEmail({
      to,
      subject: resolvedSubject,
      htmlBody,
      textBody,
      pdfBuffer,
      filename: `crisis-plan-v${plan.versionNumber}.pdf`,
    })

    if (!result.sent) {
      return NextResponse.json({ sent: false, error: result.error })
    }

    await db.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId: plan.clientId,
      eventType: "crisis_plan.emailed",
      entityType: "crisis_plan",
      entityId: crisisPlanId,
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("Failed to send crisis plan email:", error)
    return NextResponse.json(
      {
        sent: false,
        error:
          error instanceof Error ? error.message : "Unable to send email.",
      },
      { status: 500 }
    )
  }
}
