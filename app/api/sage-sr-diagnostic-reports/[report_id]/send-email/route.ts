import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { auditEvents, clients, sageSrDiagnosticReports } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import {
  resolveReportEmail,
  type ReportEmailVariables,
} from "@/lib/email/report-templates"
import { sendReportEmail } from "@/lib/email/send-report-email"
import { buildSageSrDiagnosticReportFilename } from "@/lib/reports/filename-sage-sr-diagnostic"
import { resolveSageSrDiagnosticReportContent } from "@/lib/reports/generate-sage-sr-diagnostic-pdf"
import { getOrGenerateSageSrDiagnosticPdfBuffer } from "@/lib/reports/get-sage-sr-diagnostic-pdf-buffer"
import { REPORT_TEMPLATE_LABELS } from "@/lib/reports/templates"

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
    .from(sageSrDiagnosticReports)
    .where(
      and(
        eq(sageSrDiagnosticReports.sageSrDiagnosticReportId, reportId),
        eq(sageSrDiagnosticReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 })
  }

  const content = resolveSageSrDiagnosticReportContent(
    row.editedContentJson,
    row.generatedContentJson
  )
  if (!content) {
    return NextResponse.json(
      { error: "Invalid report content." },
      { status: 500 }
    )
  }

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
    })
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
  const reportTitle = REPORT_TEMPLATE_LABELS.sage_sr_diagnostic
  const variables: ReportEmailVariables = {
    recipient_name: "Colleague",
    client_name: clientName,
    report_title: reportTitle,
    report_title_lower: reportTitle.toLowerCase(),
    practice_name: emailContext.practiceName,
    practitioner_name: emailContext.practitionerName,
  }

  const meta = {
    title: reportTitle,
    clientName,
    dateOfBirth: client.dateOfBirth,
    reportDate: row.reportDate,
    practiceName: emailContext.practiceName,
  }

  try {
    const pdfBuffer = await getOrGenerateSageSrDiagnosticPdfBuffer(
      row.pdfStoragePath,
      reportId,
      row.clientId,
      context.practiceId,
      meta,
      content
    )

    const { subject: resolvedSubject, htmlBody, textBody } = resolveReportEmail(
      subject,
      message,
      variables
    )

    const filename = buildSageSrDiagnosticReportFilename(
      meta,
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
      entityType: "sage_sr_diagnostic_report",
      entityId: reportId,
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("Failed to send SAGE-SR diagnostic report email:", error)
    return NextResponse.json(
      {
        sent: false,
        error: error instanceof Error ? error.message : "Unable to send email.",
      },
      { status: 500 }
    )
  }
}
