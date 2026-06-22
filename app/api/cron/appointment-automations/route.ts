import { NextResponse } from "next/server"

import { autoCompleteElapsedAppointments } from "@/lib/appointments/auto-complete"
import {
  runAppointmentAutomations,
  type AppointmentAutomationSummary,
} from "@/lib/appointments/run-automations"

function emptySummary(error: string): AppointmentAutomationSummary & {
  error: string
  appointments_completed: number
} {
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

    // Step 1: Auto-complete elapsed appointments BEFORE running automations
    // so that newly-completed appointments can trigger post-session emails
    // in the same cron pass.
    //
    // NOTE: This is the temporary cron trigger. When migrating to Supabase
    // pg_cron or event-driven scheduling, move this call to the new trigger
    // and remove it from here.
    const completionResult = await autoCompleteElapsedAppointments()

    // Step 2: Run email automations (reminders, pre-session, post-session)
    const automationSummary = await runAppointmentAutomations()

    return NextResponse.json({
      appointments_completed: completionResult.completed,
      ...automationSummary,
      errors: [...completionResult.errors, ...automationSummary.errors],
    })
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
