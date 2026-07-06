import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { auditEvents, clients, simpleReports } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import {
  resolveReportEmail,
  type ReportEmailVariables,
} from "@/lib/email/report-templates"
import { sendReportEmail } from "@/lib/email/send-report-email"
import { buildReportFilename } from "@/lib/reports/filename"
import { getOrGenerateReportPdfBuffer } from "@/lib/reports/get-pdf-buffer"
import { parseReportSnapshot } from "@/lib/reports/snapshot"

type SendReportEmailBody = {
  to?: string
  subject?: string
  message?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ report_id: string }> }
) {
  const { report_id: reportId } = await params
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: SendReportEmailBody
  try {
    body = (await request.json()) as SendReportEmailBody
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
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.simpleReportId, reportId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 })
  }

  const snapshot = parseReportSnapshot(row.valuesSnapshotJson)
  if (!snapshot) {
    return NextResponse.json({ error: "Invalid report snapshot." }, { status: 500 })
  }

  const [client] = await db
    .select({ firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(eq(clients.clientId, row.clientId))
    .limit(1)

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

  const clientName = `${client.firstName} ${client.lastName}`
  const recipientName =
    snapshot.recipient?.type === "referrer"
      ? snapshot.recipient.name || "Colleague"
      : client.firstName || "there"

  const variables: ReportEmailVariables = {
    recipient_name: recipientName,
    client_name: clientName,
    report_title: snapshot.reportTitle,
    report_title_lower: snapshot.reportTitle.toLowerCase(),
    practice_name: emailContext.practiceName,
    practitioner_name: emailContext.practitionerName,
  }

  try {
    const pdfBuffer = await getOrGenerateReportPdfBuffer(
      row.pdfStoragePath,
      reportId,
      row.clientId,
      context.practiceId,
      snapshot
    )

    const { subject: resolvedSubject, htmlBody, textBody } = resolveReportEmail(
      subject,
      message,
      variables
    )

    const filename = buildReportFilename(
      snapshot,
      row.reportDate ? String(row.reportDate) : null,
      client.lastName,
      client.firstName
    )

    const result = await sendReportEmail({
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
      clientId: row.clientId,
      eventType: "report.emailed",
      entityType: "simple_report",
      entityId: reportId,
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("Failed to send report email:", error)
    return NextResponse.json(
      {
        sent: false,
        error: error instanceof Error ? error.message : "Unable to send email.",
      },
      { status: 500 }
    )
  }
}
