import { and, eq } from "drizzle-orm"

import { simpleReports } from "@/db/schema"
import { db } from "@/lib/db"
import { generateReportPdf } from "@/lib/reports/generate-pdf"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "report-pdfs"

export function buildReportPdfPath(
  clientId: string,
  reportId: string,
  dateRangeEnd: string
): string {
  return `${clientId}/${dateRangeEnd}_${reportId}.pdf`
}

export type UploadReportPdfResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export async function uploadReportPdf(
  reportId: string,
  clientId: string,
  practiceId: string,
  snapshot: ReportSnapshot
): Promise<UploadReportPdfResult> {
  try {
    const buffer = await generateReportPdf(snapshot)
    const path = buildReportPdfPath(clientId, reportId, snapshot.dateRangeEnd)

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true })

    if (uploadError) return { ok: false, error: uploadError.message }

    await db
      .update(simpleReports)
      .set({ pdfStoragePath: path, updatedAt: new Date() })
      .where(
        and(
          eq(simpleReports.simpleReportId, reportId),
          eq(simpleReports.practiceId, practiceId)
        )
      )

    return { ok: true, path }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
