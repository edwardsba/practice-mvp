import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { crisisPlans } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateAndStoreCrisisPlanPdf } from "@/lib/crisis-plan/generate-pdf"
import {
  loadEmergencyContacts,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import { rowToCrisisPlan } from "@/lib/crisis-plans/serialize"

type GeneratePdfBody = {
  crisis_plan_id?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: GeneratePdfBody
  try {
    body = (await request.json()) as GeneratePdfBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const crisisPlanId = body.crisis_plan_id?.trim()
  if (!crisisPlanId) {
    return NextResponse.json(
      { error: "crisis_plan_id is required." },
      { status: 400 }
    )
  }

  const [row] = await db
    .select()
    .from(crisisPlans)
    .where(
      and(
        eq(crisisPlans.crisisPlanId, crisisPlanId),
        eq(crisisPlans.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Crisis plan not found." }, { status: 404 })
  }

  const plan = rowToCrisisPlan(row)
  const client = await verifyClientInPractice(plan.clientId, context.practiceId)
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const contacts = await loadEmergencyContacts(plan.clientId, context.practiceId)
  const clientName = `${client.firstName} ${client.lastName}`

  try {
    const { signedUrl } = await generateAndStoreCrisisPlanPdf({
      plan,
      contacts,
      clientName,
    })

    return NextResponse.json({ signedUrl })
  } catch (error) {
    console.error("Failed to generate crisis plan PDF:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to generate PDF.",
      },
      { status: 500 }
    )
  }
}
