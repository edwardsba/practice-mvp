import { and, eq } from "drizzle-orm"

import { sageSrDiagnosticReports } from "@/db/schema"
import { db } from "@/lib/db"
import {
  generateSageSrDiagnosticReportPdf,
  type SageSrDiagnosticReportPdfMeta,
} from "@/lib/reports/generate-sage-sr-diagnostic-pdf"
import type { SageSrDiagnosticReportContent } from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "report-pdfs"

export function buildSageSrDiagnosticPdfStoragePath(
  clientId: string,
  reportId: string
): string {
  return `sage-sr-diagnostic/${clientId}/${reportId}.pdf`
}

export type UploadSageSrDiagnosticPdfResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export async function uploadSageSrDiagnosticPdf(
  reportId: string,
  clientId: string,
  practiceId: string,
  meta: SageSrDiagnosticReportPdfMeta,
  content: SageSrDiagnosticReportContent
): Promise<UploadSageSrDiagnosticPdfResult> {
  try {
    const buffer = await generateSageSrDiagnosticReportPdf(meta, content)
    const path = buildSageSrDiagnosticPdfStoragePath(clientId, reportId)

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true })

    if (uploadError) return { ok: false, error: uploadError.message }

    await db
      .update(sageSrDiagnosticReports)
      .set({ pdfStoragePath: path, updatedAt: new Date() })
      .where(
        and(
          eq(sageSrDiagnosticReports.sageSrDiagnosticReportId, reportId),
          eq(sageSrDiagnosticReports.practiceId, practiceId)
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
