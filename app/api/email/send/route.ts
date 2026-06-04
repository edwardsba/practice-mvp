import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { assessmentAccessLinks, auditEvents } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendQuestionnaireEmail } from "@/lib/email/send-questionnaire-link"

type SendEmailBody = {
  to?: string
  subject?: string
  htmlBody?: string
  textBody?: string
  assessmentAccessLinkId?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: SendEmailBody
  try {
    body = (await request.json()) as SendEmailBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const to = body.to?.trim()
  const subject = body.subject?.trim()
  const htmlBody = body.htmlBody?.trim()
  const textBody = body.textBody?.trim()
  const assessmentAccessLinkId = body.assessmentAccessLinkId?.trim()

  if (!to || !subject || !htmlBody || !textBody || !assessmentAccessLinkId) {
    return NextResponse.json(
      {
        error:
          "to, subject, htmlBody, textBody, and assessmentAccessLinkId are required.",
      },
      { status: 400 }
    )
  }

  const [accessLink] = await db
    .select({
      assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
      practiceId: assessmentAccessLinks.practiceId,
      clientId: assessmentAccessLinks.clientId,
    })
    .from(assessmentAccessLinks)
    .where(
      and(
        eq(
          assessmentAccessLinks.assessmentAccessLinkId,
          assessmentAccessLinkId
        ),
        eq(assessmentAccessLinks.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!accessLink) {
    return NextResponse.json({ error: "Assessment link not found." }, { status: 404 })
  }

  const result = await sendQuestionnaireEmail({
    to,
    subject,
    htmlBody,
    textBody,
  })

  if (!result.sent) {
    return NextResponse.json({
      sent: false,
      error: result.error,
    })
  }

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId: accessLink.clientId,
    eventType: "email.sent",
    entityType: "assessment_access_link",
    entityId: assessmentAccessLinkId,
  })

  return NextResponse.json({ sent: true })
}
