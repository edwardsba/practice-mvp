import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { clients, treatmentPlans } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { rowToTreatmentPlan } from "@/lib/treatment-plans/serialize"
import { uploadTreatmentPlanPdf } from "@/lib/treatment-plans/upload-pdf"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "treatment-plan-pdfs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ plan_id: string }> }
) {
  const { plan_id: planId } = await params
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [row] = await db
    .select()
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.treatmentPlanId, planId),
        eq(treatmentPlans.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const plan = rowToTreatmentPlan(row)

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
    })
    .from(clients)
    .where(eq(clients.clientId, plan.clientId))
    .limit(1)

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  const filename = `${new Date().toISOString().slice(0, 10)}_Confidential_Treatment_Plan_v${plan.versionNumber}_${client.lastName}_${client.firstName?.[0] ?? ""}.pdf`

  const supabase = createAdminClient()
  let pdfBuffer: Buffer

  if (row.pdfStoragePath) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(row.pdfStoragePath)

    if (!error && data) {
      pdfBuffer = Buffer.from(await data.arrayBuffer())
    } else {
      const result = await uploadTreatmentPlanPdf(plan, client, context.practiceId)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      const { data: retryData } = await supabase.storage
        .from(BUCKET)
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
    const result = await uploadTreatmentPlanPdf(plan, client, context.practiceId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    const { data } = await supabase.storage.from(BUCKET).download(result.path)
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
