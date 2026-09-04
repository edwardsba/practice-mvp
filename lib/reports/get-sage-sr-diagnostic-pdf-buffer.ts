import type { SageSrDiagnosticReportContent } from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"
import type { SageSrDiagnosticReportPdfMeta } from "@/lib/reports/generate-sage-sr-diagnostic-pdf"
import { uploadSageSrDiagnosticPdf } from "@/lib/reports/upload-sage-sr-diagnostic-pdf"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "report-pdfs"

export async function getOrGenerateSageSrDiagnosticPdfBuffer(
  pdfStoragePath: string | null,
  reportId: string,
  clientId: string,
  practiceId: string,
  meta: SageSrDiagnosticReportPdfMeta,
  content: SageSrDiagnosticReportContent
): Promise<Buffer> {
  const supabase = createAdminClient()

  if (pdfStoragePath) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(pdfStoragePath)
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer())
    }
  }

  const result = await uploadSageSrDiagnosticPdf(
    reportId,
    clientId,
    practiceId,
    meta,
    content
  )
  if (!result.ok) {
    throw new Error(result.error)
  }
  const { data } = await supabase.storage.from(BUCKET).download(result.path)
  if (!data) {
    throw new Error("PDF generation failed")
  }
  return Buffer.from(await data.arrayBuffer())
}
