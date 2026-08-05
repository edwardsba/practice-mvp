import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
  assessmentAccessLinks,
  auditEvents,
  clients,
  communications,
} from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendQuestionnaireEmail } from "@/lib/email/send-questionnaire-link"

// Template types whose send flow is backed by an assessment_access_links row
// (a single assessment or a full battery) rather than a plain client-scoped
// message. These get the access-link communications record + audit event.
const ASSESSMENT_LINK_TEMPLATE_TYPES = ["send_assessment", "diagnostic_battery"]

type SendEmailBody = {
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  htmlBody?: string
  textBody?: string
  messageText?: string
  templateType?: string
  assessmentAccessLinkId?: string
  clientId?: string
}

async function logCommunication({
  practiceId,
  clientId,
  practitionerProfileId,
  templateType,
  toEmail,
  ccEmail,
  bccEmail,
  subject,
  messageText,
  assessmentAccessLinkId,
  status,
  errorMessage,
}: {
  practiceId: string
  clientId: string
  practitionerProfileId: string
  templateType: string
  toEmail: string
  ccEmail?: string | null
  bccEmail?: string | null
  subject: string
  messageText?: string | null
  assessmentAccessLinkId?: string | null
  status: "sent" | "failed"
  errorMessage?: string | null
}) {
  const [record] = await db
    .insert(communications)
    .values({
      practiceId,
      clientId,
      practitionerProfileId,
      templateType,
      toEmail,
      ccEmail: ccEmail || null,
      bccEmail: bccEmail || null,
      subject,
      messageText: messageText || null,
      assessmentAccessLinkId: assessmentAccessLinkId || null,
      status,
      errorMessage: errorMessage || null,
    })
    .returning({ communicationId: communications.communicationId })

  return record?.communicationId ?? null
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
  const cc = body.cc?.trim()
  const bcc = body.bcc?.trim()
  const subject = body.subject?.trim()
  const htmlBody = body.htmlBody?.trim()
  const textBody = body.textBody?.trim()
  const messageText = body.messageText?.trim()
  const assessmentAccessLinkId = body.assessmentAccessLinkId?.trim()
  const clientIdParam = body.clientId?.trim()
  const templateType =
    body.templateType?.trim() ||
    (assessmentAccessLinkId ? "send_assessment" : "")

  if (!to || !subject || !htmlBody || !textBody) {
    return NextResponse.json(
      { error: "to, subject, htmlBody, and textBody are required." },
      { status: 400 }
    )
  }

  if (
    ASSESSMENT_LINK_TEMPLATE_TYPES.includes(templateType) &&
    !assessmentAccessLinkId
  ) {
    return NextResponse.json(
      {
        error: `assessmentAccessLinkId is required for ${templateType} emails.`,
      },
      { status: 400 }
    )
  }

  if (!ASSESSMENT_LINK_TEMPLATE_TYPES.includes(templateType) && !clientIdParam) {
    return NextResponse.json(
      { error: "clientId is required for this email template." },
      { status: 400 }
    )
  }

  let resolvedClientId: string | null = null
  let resolvedAssessmentAccessLinkId: string | null = null

  if (ASSESSMENT_LINK_TEMPLATE_TYPES.includes(templateType)) {
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
            assessmentAccessLinkId!
          ),
          eq(assessmentAccessLinks.practiceId, context.practiceId)
        )
      )
      .limit(1)

    if (!accessLink) {
      return NextResponse.json(
        { error: "Assessment link not found." },
        { status: 404 }
      )
    }

    resolvedClientId = accessLink.clientId
    resolvedAssessmentAccessLinkId = accessLink.assessmentAccessLinkId
  } else {
    const [clientRecord] = await db
      .select({ clientId: clients.clientId })
      .from(clients)
      .where(
        and(
          eq(clients.clientId, clientIdParam!),
          eq(clients.practiceId, context.practiceId),
          eq(clients.isActive, true)
        )
      )
      .limit(1)

    if (!clientRecord) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 })
    }

    resolvedClientId = clientRecord.clientId
  }

  const result = await sendQuestionnaireEmail({
    to,
    cc,
    bcc,
    subject,
    htmlBody,
    textBody,
  })

  if (!result.sent) {
    await logCommunication({
      practiceId: context.practiceId,
      clientId: resolvedClientId,
      practitionerProfileId: context.practitionerProfileId,
      templateType,
      toEmail: to,
      ccEmail: cc,
      bccEmail: bcc,
      subject,
      messageText,
      assessmentAccessLinkId: resolvedAssessmentAccessLinkId,
      status: "failed",
      errorMessage: result.error,
    })

    return NextResponse.json({
      sent: false,
      error: result.error,
    })
  }

  const communicationId = await logCommunication({
    practiceId: context.practiceId,
    clientId: resolvedClientId,
    practitionerProfileId: context.practitionerProfileId,
    templateType,
    toEmail: to,
    ccEmail: cc,
    bccEmail: bcc,
    subject,
    messageText,
    assessmentAccessLinkId: resolvedAssessmentAccessLinkId,
    status: "sent",
  })

  if (ASSESSMENT_LINK_TEMPLATE_TYPES.includes(templateType)) {
    await db.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId: resolvedClientId,
      eventType: "email.sent",
      entityType: "assessment_access_link",
      entityId: resolvedAssessmentAccessLinkId!,
    })
  } else {
    await db.insert(auditEvents).values({
      practiceId: context.practiceId,
      userId: context.userId,
      clientId: resolvedClientId,
      eventType: "email.sent",
      entityType: "communication",
      entityId: communicationId ?? resolvedClientId,
    })
  }

  return NextResponse.json({ sent: true })
}
