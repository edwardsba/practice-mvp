import { generateAndStoreCrisisPlanPdf } from "@/lib/crisis-plan/generate-pdf"
import type { CrisisPlanRow, EmergencyContactRow } from "@/lib/crisis-plans/types"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "crisis-plans"

export async function getOrGenerateCrisisPlanPdfBuffer(
  pdfStoragePath: string | null,
  plan: CrisisPlanRow,
  contacts: EmergencyContactRow[],
  clientName: string
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

  const { pdfBuffer } = await generateAndStoreCrisisPlanPdf({
    plan,
    contacts,
    clientName,
  })
  return pdfBuffer
}
