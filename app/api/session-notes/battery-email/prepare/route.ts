import { NextResponse } from "next/server"

import { prepareBatteryEmailDraft } from "@/lib/appointments/prepare-battery-email"
import { getPractitionerContext } from "@/lib/auth"

type PrepareBatteryEmailBody = {
  appointmentId?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: PrepareBatteryEmailBody
  try {
    body = (await request.json()) as PrepareBatteryEmailBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const appointmentId = body.appointmentId?.trim()
  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointmentId is required." },
      { status: 400 }
    )
  }

  const result = await prepareBatteryEmailDraft(
    appointmentId,
    context.practiceId
  )

  return NextResponse.json(result)
}
