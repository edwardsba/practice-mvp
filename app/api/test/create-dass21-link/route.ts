import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

import { clients, practitionerPracticeMemberships } from "@/db/schema"
import { createAssessmentLink } from "@/lib/assessments/create-assessment-link"
import { db } from "@/lib/db"

// TEMPORARY test-only route for manually exercising the DASS-21 seed + scoring end-to-end.
// Only needs clientId — practiceId and practitionerProfileId are resolved automatically.
// Delete this file once verified — not meant to ship.
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

  const result = await createAssessmentLink({
    clientId,
    practiceId: client.practiceId,
    practitionerProfileId: membership.practitionerProfileId,
    assessmentCode: "DASS21",
    userId: null,
  })

  return NextResponse.json(result)
}
