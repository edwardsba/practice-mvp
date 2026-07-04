import { eq } from "drizzle-orm"

import { crisisPlans } from "@/db/schema"
import { buildCrisisPlanPdfData } from "@/lib/crisis-plan/build-pdf-data"
import { generateCrisisPlanPdf } from "@/lib/crisis-plan/pdf-document"
import type { CrisisPlanRow, EmergencyContactRow } from "@/lib/crisis-plans/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { db } from "@/lib/db"

const BUCKET = "crisis-plans"
const SIGNED_URL_TTL_SECONDS = 60 * 60

export async function generateAndStoreCrisisPlanPdf({
  plan,
  contacts,
  clientName,
}: {
  plan: CrisisPlanRow
  contacts: EmergencyContactRow[]
  clientName: string
}) {
  const pdfData = buildCrisisPlanPdfData(plan, contacts, clientName)
  const buffer = await generateCrisisPlanPdf(pdfData)

  const storagePath = `${plan.practiceId}/${plan.clientId}/${plan.crisisPlanId}.pdf`
  const supabase = createAdminClient()

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const now = new Date()
  await db
    .update(crisisPlans)
    .set({ pdfStoragePath: storagePath, updatedAt: now })
    .where(eq(crisisPlans.crisisPlanId, plan.crisisPlanId))

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message ?? "Unable to create download URL.")
  }

  return {
    storagePath,
    signedUrl: signed.signedUrl,
    pdfBuffer: buffer,
  }
}
