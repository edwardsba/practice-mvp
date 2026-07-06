import { uploadReportPdf } from "@/lib/reports/upload-pdf"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "report-pdfs"

export async function getOrGenerateReportPdfBuffer(
  pdfStoragePath: string | null,
  reportId: string,
  clientId: string,
  practiceId: string,
  snapshot: ReportSnapshot
): Promise<Buffer> {
  const supabase = createAdminClient()

  if (pdfStoragePath) {
    const { data, error } = await supabase.storage.from(BUCKET).download(pdfStoragePath)
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer())
    }
  }

  const result = await uploadReportPdf(reportId, clientId, practiceId, snapshot)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const { data } = await supabase.storage.from(BUCKET).download(result.path)
  if (!data) {
    throw new Error("PDF generation failed")
  }
  return Buffer.from(await data.arrayBuffer())
}
