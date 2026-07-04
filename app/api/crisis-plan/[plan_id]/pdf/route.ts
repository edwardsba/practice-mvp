import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { crisisPlans } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildCrisisPlanFilename } from "@/lib/crisis-plan/filename"
import { getOrGenerateCrisisPlanPdfBuffer } from "@/lib/crisis-plan/get-pdf-buffer"
import {
  loadEmergencyContacts,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import { rowToCrisisPlan } from "@/lib/crisis-plans/serialize"

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
    .from(crisisPlans)
    .where(
      and(
        eq(crisisPlans.crisisPlanId, planId),
        eq(crisisPlans.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const plan = rowToCrisisPlan(row)
  const client = await verifyClientInPractice(plan.clientId, context.practiceId)
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  const filename = buildCrisisPlanFilename(
    plan.versionNumber,
    client.lastName,
    client.firstName
  )

  let pdfBuffer: Buffer
  try {
    const contacts = await loadEmergencyContacts(plan.clientId, context.practiceId)
    const clientName = `${client.firstName} ${client.lastName}`
    pdfBuffer = await getOrGenerateCrisisPlanPdfBuffer(
      row.pdfStoragePath,
      plan,
      contacts,
      clientName
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed" },
      { status: 500 }
    )
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
