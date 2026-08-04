import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

import { clients, practitionerPracticeMemberships } from "@/db/schema"
import { createDiagnosticBatteryInstance } from "@/lib/assessments/create-diagnostic-battery-instance"
import { db } from "@/lib/db"

// TEMPORARY test-only route for verifying the carry-forward mechanism (Pass 3): confirms the
// carried_responses_json column gets written correctly at trigger time, and that item 1 renders
// pre-filled (but editable) on the triggered severity scale. Uses createDiagnosticBatteryInstance
// since this needs a full battery chain starting at Level 1 XC. Delete once verified.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId")

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId query param is required." },
      { status: 400 }
    )
  }

  const [client] = await db
    .select({ practiceId: clients.practiceId })
    .from(clients)
    .where(eq(clients.clientId, clientId))
    .limit(1)

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const [membership] = await db
    .select({
      practitionerProfileId: practitionerPracticeMemberships.practitionerProfileId,
    })
    .from(practitionerPracticeMemberships)
    .where(eq(practitionerPracticeMemberships.practiceId, client.practiceId))
    .limit(1)

  if (!membership) {
    return NextResponse.json(
      { error: "No practitioner membership found for this client's practice." },
      { status: 404 }
    )
  }

  const result = await createDiagnosticBatteryInstance({
    clientId,
    practiceId: client.practiceId,
    practitionerProfileId: membership.practitionerProfileId,
  })

  return NextResponse.json(result)
}
