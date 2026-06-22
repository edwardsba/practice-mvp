"use server"

import { and, inArray, lt } from "drizzle-orm"

import { appointments, auditEvents } from "@/db/schema"
import { todayDateString } from "@/lib/appointments/format"
import { db } from "@/lib/db"

export type AutoCompleteResult = {
  completed: number
  errors: string[]
}

/**
 * Marks all elapsed appointments as "completed".
 *
 * Criteria: appointmentDate < today (Sydney) AND status IN ('scheduled', 'confirmed')
 *
 * Intentionally decoupled from its trigger — currently called by the daily
 * cron job but designed to be called by Supabase pg_cron, QStash, or any
 * other scheduler in future without changing this function.
 *
 * Must run BEFORE runAppointmentAutomations() in the cron pass so that
 * newly-completed appointments can trigger post-session emails in the same run.
 */
export async function autoCompleteElapsedAppointments(): Promise<AutoCompleteResult> {
  const result: AutoCompleteResult = { completed: 0, errors: [] }

  try {
    const todayStr = todayDateString()

    const elapsed = await db
      .select({
        appointmentId: appointments.appointmentId,
        practiceId: appointments.practiceId,
        clientId: appointments.clientId,
      })
      .from(appointments)
      .where(
        and(
          lt(appointments.appointmentDate, todayStr),
          inArray(appointments.status, ["scheduled", "confirmed"])
        )
      )

    if (elapsed.length === 0) {
      return result
    }

    const now = new Date()
    const appointmentIds = elapsed.map((a) => a.appointmentId)

    await db.transaction(async (tx) => {
      await tx
        .update(appointments)
        .set({ status: "completed", updatedAt: now })
        .where(inArray(appointments.appointmentId, appointmentIds))

      await tx.insert(auditEvents).values(
        elapsed.map((a) => ({
          practiceId: a.practiceId,
          userId: null,
          clientId: a.clientId,
          eventType: "appointment.auto_completed",
          entityType: "appointment",
          entityId: a.appointmentId,
        }))
      )
    })

    result.completed = elapsed.length
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Auto-complete failed."
    console.error("autoCompleteElapsedAppointments error:", error)
    result.errors.push(message)
  }

  return result
}
