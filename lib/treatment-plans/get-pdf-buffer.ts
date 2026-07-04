import type { TreatmentPlanPdfClient } from "@/lib/treatment-plans/generate-pdf"
import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import { uploadTreatmentPlanPdf } from "@/lib/treatment-plans/upload-pdf"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "treatment-plan-pdfs"

export async function getOrGenerateTreatmentPlanPdfBuffer(
  pdfStoragePath: string | null,
  plan: TreatmentPlanRow,
  client: TreatmentPlanPdfClient,
  practiceId: string
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

  const result = await uploadTreatmentPlanPdf(plan, client, practiceId)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const { data } = await supabase.storage.from(BUCKET).download(result.path)
  if (!data) {
    throw new Error("PDF generation failed")
  }
  return Buffer.from(await data.arrayBuffer())
}
