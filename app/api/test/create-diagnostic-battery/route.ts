import { NextRequest, NextResponse } from "next/server"

import { createDiagnosticBatteryInstance } from "@/lib/assessments/create-diagnostic-battery-instance"

// TEMPORARY test-only route for manually exercising createDiagnosticBatteryInstance end-to-end.
// Delete this file once the diagnostic battery flow has been verified — not meant to ship.
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

  const result = await createDiagnosticBatteryInstance({
    clientId,
    practiceId,
    practitionerProfileId,
  })

  return NextResponse.json(result)
}
