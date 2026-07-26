import { NextResponse } from "next/server"

import {
  runAppointmentAutomations,
  type AppointmentAutomationSummary,
} from "@/lib/appointments/run-automations"

function emptySummary(
  error: string
): AppointmentAutomationSummary & { error: string } {
  return {
    appointments_completed: 0,
    reminders_sent: 0,
    batteries_sent: 0,
    post_session_sent: 0,
    errors: [error],
    error,
  }
}

async function handleCron(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json(
        emptySummary("CRON_SECRET is not configured."),
        { status: 500 }
      )
    }
    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Completion and post-session feedback both happen inside this call now,
    // triggered by each appointment's own end time rather than a separate
    // calendar-day step run beforehand.
    const automationSummary = await runAppointmentAutomations()

    return NextResponse.json(automationSummary)
  } catch (error) {
    console.error("Appointment automations cron failed:", error)
    const message =
      error instanceof Error ? error.message : "Automation run failed."
    return NextResponse.json(emptySummary(message), { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleCron(request)
}

export async function POST(request: Request) {
  return handleCron(request)
}
