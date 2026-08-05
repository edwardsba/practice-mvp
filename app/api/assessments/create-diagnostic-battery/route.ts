import { NextResponse } from "next/server"

import { createDiagnosticBatteryInstance } from "@/lib/assessments/create-diagnostic-battery-instance"
import { getPractitionerContext } from "@/lib/auth"

type CreateDiagnosticBatteryBody = {
  client_id?: string
  practitioner_profile_id?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: CreateDiagnosticBatteryBody
  try {
    body = (await request.json()) as CreateDiagnosticBatteryBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const clientId = body.client_id?.trim()
  const practitionerProfileId = body.practitioner_profile_id?.trim()

  if (!clientId || !practitionerProfileId) {
    return NextResponse.json(
      { error: "client_id and practitioner_profile_id are required." },
      { status: 400 }
    )
  }

  if (practitionerProfileId !== context.practitionerProfileId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const result = await createDiagnosticBatteryInstance({
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId,
    userId: context.userId,
  })

  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    link: result.link,
    expires_at: result.expiresAt.toISOString(),
    assessmentAccessLinkId: result.firstAccessLinkId,
    clientEmail: result.clientEmail,
    templateVariables: result.templateVariables,
  })
}
