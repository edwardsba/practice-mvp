import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { auditEvents, treatmentPlans } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { sendTreatmentPlanEmail } from "@/lib/email/send-treatment-plan-email"
import {
  resolveTreatmentPlanEmail,
  type TreatmentPlanEmailVariables,
} from "@/lib/email/treatment-plan-templates"
import { buildTreatmentPlanFilename } from "@/lib/treatment-plans/filename"
import { getOrGenerateTreatmentPlanPdfBuffer } from "@/lib/treatment-plans/get-pdf-buffer"
import { verifyClientInPractice } from "@/lib/treatment-plans/load"
import { rowToTreatmentPlan } from "@/lib/treatment-plans/serialize"

type SendTreatmentPlanEmailBody = {
  to?: string
  subject?: string
  message?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ plan_id: string }> }
) {
  const { plan_id: planId } = await params
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: SendTreatmentPlanEmailBody
  try {
    body = (await request.json()) as SendTreatmentPlanEmailBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const to = body.to?.trim()
  const subject = body.subject?.trim()
  const message = body.message?.trim()

  if (!to || !subject || !message) {
    return NextResponse.json(
      { error: "to, subject, and message are required." },
      { status: 400 }
    )
  }

  const [row] = await db
    .select()
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.treatmentPlanId, planId),
        eq(treatmentPlans.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Treatment plan not found." }, { status: 404 })
  }

  const plan = rowToTreatmentPlan(row)
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

  const variables: TreatmentPlanEmailVariables = {
    client_first_name: client.firstName.trim() || "there",
    practice_name: emailContext.practiceName,
    practitioner_name: emailContext.practitionerName,
  }

  try {
    const pdfBuffer = await getOrGenerateTreatmentPlanPdfBuffer(
      row.pdfStoragePath,
      plan,
      client,
      context.practiceId
    )

    const { subject: resolvedSubject, htmlBody, textBody } =
      resolveTreatmentPlanEmail(subject, message, variables)

    const filename = buildTreatmentPlanFilename(
      plan.versionNumber,
      client.lastName,
      client.firstName
    )

    const result = await sendTreatmentPlanEmail({
      to,
      subject: resolvedSubject,
      htmlBody,
      textBody,
      pdfBuffer,
      filename,
    })

    if (!result.sent) {
      return NextResponse.json({ sent: false, error: result.error })
    }

    await db.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId: plan.clientId,
      eventType: "treatment_plan.emailed",
      entityType: "treatment_plan",
      entityId: planId,
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("Failed to send treatment plan email:", error)
    return NextResponse.json(
      {
        sent: false,
        error: error instanceof Error ? error.message : "Unable to send email.",
      },
      { status: 500 }
    )
  }
}
