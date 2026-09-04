import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { clients, practices, sageSrDiagnosticReports } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildSageSrDiagnosticReportFilename } from "@/lib/reports/filename-sage-sr-diagnostic"
import { resolveSageSrDiagnosticReportContent } from "@/lib/reports/generate-sage-sr-diagnostic-pdf"
import { getOrGenerateSageSrDiagnosticPdfBuffer } from "@/lib/reports/get-sage-sr-diagnostic-pdf-buffer"
import { REPORT_TEMPLATE_LABELS } from "@/lib/reports/templates"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ report_id: string }> }
) {
  const { report_id: reportId } = await params
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [report] = await db
    .select({
      sageSrDiagnosticReportId: sageSrDiagnosticReports.sageSrDiagnosticReportId,
      clientId: sageSrDiagnosticReports.clientId,
      pdfStoragePath: sageSrDiagnosticReports.pdfStoragePath,
      generatedContentJson: sageSrDiagnosticReports.generatedContentJson,
      editedContentJson: sageSrDiagnosticReports.editedContentJson,
      reportDate: sageSrDiagnosticReports.reportDate,
    })
    .from(sageSrDiagnosticReports)
    .where(
      and(
        eq(sageSrDiagnosticReports.sageSrDiagnosticReportId, reportId),
        eq(sageSrDiagnosticReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const content = resolveSageSrDiagnosticReportContent(
    report.editedContentJson,
    report.generatedContentJson
  )
  if (!content) {
    return NextResponse.json({ error: "Invalid report content" }, { status: 500 })
  }

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
    })
    .from(clients)
    .where(eq(clients.clientId, report.clientId))
    .limit(1)

  const [practice] = await db
    .select({ practiceName: practices.practiceName })
    .from(practices)
    .where(eq(practices.practiceId, context.practiceId))
    .limit(1)

  const reportTitle = REPORT_TEMPLATE_LABELS.sage_sr_diagnostic
  const meta = {
    title: reportTitle,
    clientName: client
      ? `${client.firstName} ${client.lastName}`
      : "Unknown",
    dateOfBirth: client?.dateOfBirth ?? null,
    reportDate: report.reportDate,
    practiceName: practice?.practiceName ?? "—",
  }

  const filename = buildSageSrDiagnosticReportFilename(
    meta,
    client?.lastName ?? "Unknown",
    client?.firstName ?? ""
  )

  try {
    const pdfBuffer = await getOrGenerateSageSrDiagnosticPdfBuffer(
      report.pdfStoragePath,
      reportId,
      report.clientId,
      context.practiceId,
      meta,
      content
    )

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "PDF generation failed",
      },
      { status: 500 }
    )
  }
}
