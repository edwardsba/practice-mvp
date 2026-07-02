import { NextResponse } from "next/server"

import { sendBatteryEmailWithDraft } from "@/lib/appointments/prepare-battery-email"
import { getPractitionerContext } from "@/lib/auth"

type SendBatteryEmailBody = {
  appointmentId?: string
  subject?: string
  message?: string
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: SendBatteryEmailBody
  try {
    body = (await request.json()) as SendBatteryEmailBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const appointmentId = body.appointmentId?.trim()
  const subject = body.subject?.trim()
  const message = body.message?.trim()

  if (!appointmentId || !subject || !message) {
    return NextResponse.json(
      { error: "appointmentId, subject, and message are required." },
      { status: 400 }
    )
  }

  const result = await sendBatteryEmailWithDraft(
    appointmentId,
    context.practiceId,
    context.userId,
    subject,
    message
  )

  if (result.status === "sent") {
    return NextResponse.json({ sent: true })
  }

  if (result.status === "skipped") {
    return NextResponse.json({
      sent: false,
      skipped: true,
      reason: result.reason,
    })
  }

  return NextResponse.json({ sent: false, error: result.error })
}
