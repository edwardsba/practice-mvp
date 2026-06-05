import { NextResponse } from "next/server"

import { DEFAULT_BATTERY_CODES, normalizeBatteryCodes } from "@/lib/assessments/battery-codes"
import { createBatteryInstance } from "@/lib/assessments/create-battery-instance"
import { getPractitionerContext } from "@/lib/auth"

type CreateBatteryBody = {
  client_id?: string
  practitioner_profile_id?: string
  assessment_codes?: string[]
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: CreateBatteryBody
  try {
    body = (await request.json()) as CreateBatteryBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const clientId = body.client_id?.trim()
  const practitionerProfileId = body.practitioner_profile_id?.trim()
  const requestedCodes = body.assessment_codes?.length
    ? normalizeBatteryCodes(body.assessment_codes)
    : DEFAULT_BATTERY_CODES

  if (!clientId || !practitionerProfileId) {
    return NextResponse.json(
      { error: "client_id and practitioner_profile_id are required." },
      { status: 400 }
    )
  }

  if (practitionerProfileId !== context.practitionerProfileId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const result = await createBatteryInstance({
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId,
    assessmentCodes: requestedCodes,
    userId: context.userId,
  })

  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    link: result.link,
    expires_at: result.expiresAt.toISOString(),
    assessmentAccessLinkId: result.assessmentAccessLinkId,
    clientEmail: result.clientEmail,
    templateVariables: result.templateVariables,
  })
}
