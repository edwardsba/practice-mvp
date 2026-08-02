import { NextRequest, NextResponse } from "next/server"

import { createAssessmentLink } from "@/lib/assessments/create-assessment-link"

// TEMPORARY test-only route for manually exercising the DASS-21 seed + scoring end-to-end.
// Delete this file once verified — not meant to ship.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId")
  const practiceId = request.nextUrl.searchParams.get("practiceId")
  const practitionerProfileId = request.nextUrl.searchParams.get("practitionerProfileId")

  if (!clientId || !practiceId || !practitionerProfileId) {
    return NextResponse.json(
      { error: "clientId, practiceId, and practitionerProfileId query params are required." },
      { status: 400 }
    )
  }

  const result = await createAssessmentLink({
    clientId,
    practiceId,
    practitionerProfileId,
    assessmentCode: "DASS21",
    userId: null,
  })

  return NextResponse.json(result)
}
