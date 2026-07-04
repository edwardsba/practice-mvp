import { and, eq } from "drizzle-orm"

import { treatmentPlans } from "@/db/schema"
import { db } from "@/lib/db"
import {
  generateTreatmentPlanPdf,
  type TreatmentPlanPdfClient,
} from "@/lib/treatment-plans/generate-pdf"
import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "treatment-plan-pdfs"

export function buildTreatmentPlanPdfPath(
  clientId: string,
  treatmentPlanId: string
): string {
  return `${clientId}/${treatmentPlanId}.pdf`
}

export type UploadTreatmentPlanPdfResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export async function uploadTreatmentPlanPdf(
  plan: TreatmentPlanRow,
  client: TreatmentPlanPdfClient,
  practiceId: string
): Promise<UploadTreatmentPlanPdfResult> {
  try {
    const buffer = await generateTreatmentPlanPdf(plan, client)
    const path = buildTreatmentPlanPdfPath(plan.clientId, plan.treatmentPlanId)

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true })

    if (uploadError) return { ok: false, error: uploadError.message }

    await db
      .update(treatmentPlans)
      .set({ pdfStoragePath: path, updatedAt: new Date() })
      .where(
        and(
          eq(treatmentPlans.treatmentPlanId, plan.treatmentPlanId),
          eq(treatmentPlans.practiceId, practiceId)
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
