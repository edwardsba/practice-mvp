import { NextResponse } from "next/server"

import { createAssessmentLink } from "@/lib/assessments/create-assessment-link"
import { getPractitionerContext } from "@/lib/auth"

type CreateLinkBody = {
  client_id?: string
  assessment_code?: string
  practitioner_profile_id?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: CreateLinkBody
  try {
    body = (await request.json()) as CreateLinkBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const clientId = body.client_id?.trim()
  const assessmentCode = body.assessment_code?.trim()
  const practitionerProfileId = body.practitioner_profile_id?.trim()

  if (!clientId || !assessmentCode || !practitionerProfileId) {
    return NextResponse.json(
      {
        error:
          "client_id, assessment_code, and practitioner_profile_id are required.",
      },
      { status: 400 }
    )
  }

  if (practitionerProfileId !== context.practitionerProfileId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const result = await createAssessmentLink({
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId,
    assessmentCode,
    userId: context.userId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    link: result.link,
    expires_at: result.expiresAt.toISOString(),
    assessmentAccessLinkId: result.assessmentAccessLinkId,
    clientEmail: result.clientEmail,
    templateVariables: result.templateVariables,
  })
}
