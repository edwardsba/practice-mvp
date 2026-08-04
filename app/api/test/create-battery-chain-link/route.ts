import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

import { clients, practitionerPracticeMemberships } from "@/db/schema"
import { createDiagnosticBatteryInstance } from "@/lib/assessments/create-diagnostic-battery-instance"
import { db } from "@/lib/db"

// TEMPORARY test-only route for verifying the Specific Disorder Selector's sibling trigger
// (Level 1 XC anxiety flag -> DASS21 AND the selector, both queued directly, not one gating
// the other). Uses createDiagnosticBatteryInstance (not createAssessmentLink) since this needs
// a full battery chain starting at Level 1 XC, not a standalone link. Delete once verified.
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
