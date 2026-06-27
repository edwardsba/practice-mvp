import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { clients, simpleReports } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseReportSnapshot } from "@/lib/reports/snapshot"
import { uploadReportPdf } from "@/lib/reports/upload-pdf"
import { createAdminClient } from "@/lib/supabase/admin"

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
      simpleReportId: simpleReports.simpleReportId,
      clientId: simpleReports.clientId,
      pdfStoragePath: simpleReports.pdfStoragePath,
      valuesSnapshotJson: simpleReports.valuesSnapshotJson,
      reportDate: simpleReports.reportDate,
      dateRangeEnd: simpleReports.dateRangeEnd,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.simpleReportId, reportId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const snapshot = parseReportSnapshot(report.valuesSnapshotJson)
  if (!snapshot) {
    return NextResponse.json({ error: "Invalid snapshot" }, { status: 500 })
  }

  const [client] = await db
    .select({ firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(eq(clients.clientId, report.clientId))
    .limit(1)

  const clientLastName = client?.lastName ?? "Unknown"
  const clientFirstInitial = client?.firstName?.[0] ?? ""
  const datePrefix =
    snapshot.reportDate?.slice(0, 10) ||
    (report.reportDate ? String(report.reportDate).slice(0, 10) : "") ||
    (snapshot.dateRangeEnd ? snapshot.dateRangeEnd.slice(0, 10) : "") ||
    new Date().toISOString().slice(0, 10)
  const titleSlug = (snapshot.reportTitle || "Report")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const filename = `${datePrefix}_Confidential_${titleSlug}_${clientLastName}_${clientFirstInitial}.pdf`

  let pdfBuffer: Buffer

  if (report.pdfStoragePath) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.storage
      .from("report-pdfs")
      .download(report.pdfStoragePath)

    if (!error && data) {
      pdfBuffer = Buffer.from(await data.arrayBuffer())
    } else {
      const result = await uploadReportPdf(
        reportId,
        report.clientId,
        context.practiceId,
        snapshot
      )
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      const { data: retryData } = await supabase.storage
        .from("report-pdfs")
        .download(result.path)
      if (!retryData) {
        return NextResponse.json(
          { error: "PDF generation failed" },
          { status: 500 }
        )
      }
      pdfBuffer = Buffer.from(await retryData.arrayBuffer())
    }
  } else {
    const result = await uploadReportPdf(
      reportId,
      report.clientId,
      context.practiceId,
      snapshot
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    const supabase = createAdminClient()
    const { data } = await supabase.storage
      .from("report-pdfs")
      .download(result.path)
    if (!data) {
      return NextResponse.json(
        { error: "PDF generation failed" },
        { status: 500 }
      )
    }
    pdfBuffer = Buffer.from(await data.arrayBuffer())
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
