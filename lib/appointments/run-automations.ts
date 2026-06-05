import { and, eq, inArray, isNull } from "drizzle-orm"

import { appointments, auditEvents, clients } from "@/db/schema"
import { batteryCodesFromTreatmentPlan } from "@/lib/assessments/battery-defaults"
import { createBatteryInstance } from "@/lib/assessments/create-battery-instance"
import {
  formatAppointmentDate,
  formatAppointmentTime,
  sydneyDatePlusDays,
} from "@/lib/appointments/format"
import { db } from "@/lib/db"
import { sendAppointmentReminderEmail } from "@/lib/email/send-appointment-reminder"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { sendQuestionnaireEmail } from "@/lib/email/send-questionnaire-link"
import {
  buildResolvedEmailBodies,
  getDefaultEmailDraft,
} from "@/lib/email/templates"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"

const ACTIVE_STATUSES = ["scheduled", "confirmed"] as const

export type AppointmentAutomationSummary = {
  reminders_sent: number
  batteries_sent: number
  errors: string[]
}

export async function runAppointmentAutomations(): Promise<AppointmentAutomationSummary> {
  const summary: AppointmentAutomationSummary = {
    reminders_sent: 0,
    batteries_sent: 0,
    errors: [],
  }

  const reminderDate = sydneyDatePlusDays(2)
  const batteryDate = sydneyDatePlusDays(1)

  await processReminders(reminderDate, summary)
  await processPreSessionBatteries(batteryDate, summary)

  return summary
}

async function processReminders(
  targetDate: string,
  summary: AppointmentAutomationSummary
) {
  const rows = await db
    .select({
      appointmentId: appointments.appointmentId,
      clientId: appointments.clientId,
      practiceId: appointments.practiceId,
      practitionerProfileId: appointments.practitionerProfileId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      location: appointments.location,
      clientEmail: clients.email,
      clientFirstName: clients.firstName,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .where(
      and(
        eq(appointments.appointmentDate, targetDate),
        inArray(appointments.status, [...ACTIVE_STATUSES]),
        isNull(appointments.reminderSentAt)
      )
    )

  for (const row of rows) {
    const clientEmail = row.clientEmail?.trim()
    if (!clientEmail) {
      continue
    }

    try {
      const emailContext = await getQuestionnaireEmailContext(
        row.practiceId,
        row.practitionerProfileId
      )
      if (!emailContext) {
        summary.errors.push(
          `Reminder skipped for appointment ${row.appointmentId}: practice or practitioner not found.`
        )
        continue
      }

      const subject = `Appointment reminder from ${emailContext.practiceName}`
      const sendResult = await sendAppointmentReminderEmail({
        to: clientEmail,
        subject,
        clientFirstName: row.clientFirstName.trim() || "there",
        appointmentDate: formatAppointmentDate(row.appointmentDate),
        appointmentTime: formatAppointmentTime(row.appointmentTime),
        location: row.location?.trim() || "",
        practitionerName: emailContext.practitionerName,
        practiceName: emailContext.practiceName,
      })

      if (!sendResult.sent) {
        summary.errors.push(
          `Reminder failed for appointment ${row.appointmentId}: ${sendResult.error}`
        )
        continue
      }

      const now = new Date()
      await db.transaction(async (tx) => {
        await tx
          .update(appointments)
          .set({
            reminderSentAt: now,
            updatedAt: now,
          })
          .where(eq(appointments.appointmentId, row.appointmentId))

        await tx.insert(auditEvents).values({
          practiceId: row.practiceId,
          clientId: row.clientId,
          eventType: "appointment.reminder_sent",
          entityType: "appointment",
          entityId: row.appointmentId,
        })
      })

      summary.reminders_sent += 1
    } catch (error) {
      summary.errors.push(
        `Reminder failed for appointment ${row.appointmentId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
    }
  }
}

async function processPreSessionBatteries(
  targetDate: string,
  summary: AppointmentAutomationSummary
) {
  const rows = await db
    .select({
      appointmentId: appointments.appointmentId,
      clientId: appointments.clientId,
      practiceId: appointments.practiceId,
      practitionerProfileId: appointments.practitionerProfileId,
      clientEmail: clients.email,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .where(
      and(
        eq(appointments.appointmentDate, targetDate),
        inArray(appointments.status, [...ACTIVE_STATUSES]),
        isNull(appointments.preSessionBatterySentAt)
      )
    )

  for (const row of rows) {
    const clientEmail = row.clientEmail?.trim()
    if (!clientEmail) {
      continue
    }

    try {
      const treatmentPlan = await loadActiveTreatmentPlanSummary(
        row.clientId,
        row.practiceId
      )
      const assessmentCodes = batteryCodesFromTreatmentPlan(
        treatmentPlan?.ongoingAssessmentsJson
      )

      const batteryResult = await createBatteryInstance({
        clientId: row.clientId,
        practiceId: row.practiceId,
        practitionerProfileId: row.practitionerProfileId,
        assessmentCodes,
        userId: null,
      })

      if (!batteryResult.ok) {
        summary.errors.push(
          `Pre-session battery failed for appointment ${row.appointmentId}: ${batteryResult.error}`
        )
        continue
      }

      const draft = getDefaultEmailDraft(batteryResult.templateVariables)
      const { subject, htmlBody, textBody } = buildResolvedEmailBodies(
        draft.message,
        draft.subject,
        batteryResult.link,
        batteryResult.templateVariables
      )

      const sendResult = await sendQuestionnaireEmail({
        to: clientEmail,
        subject,
        htmlBody,
        textBody,
      })

      if (!sendResult.sent) {
        summary.errors.push(
          `Pre-session battery email failed for appointment ${row.appointmentId}: ${sendResult.error}`
        )
        continue
      }

      const now = new Date()
      await db.transaction(async (tx) => {
        await tx
          .update(appointments)
          .set({
            preSessionBatterySentAt: now,
            updatedAt: now,
          })
          .where(eq(appointments.appointmentId, row.appointmentId))

        await tx.insert(auditEvents).values({
          practiceId: row.practiceId,
          clientId: row.clientId,
          eventType: "appointment.pre_session_battery_sent",
          entityType: "appointment",
          entityId: row.appointmentId,
        })
      })

      summary.batteries_sent += 1
    } catch (error) {
      summary.errors.push(
        `Pre-session battery failed for appointment ${row.appointmentId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
    }
  }
}
