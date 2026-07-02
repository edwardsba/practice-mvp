import { and, eq, inArray, isNull } from "drizzle-orm"

import { appointments, auditEvents, clients } from "@/db/schema"
import { batteryCodesFromTreatmentPlan } from "@/lib/assessments/battery-defaults"
import { createAssessmentLink } from "@/lib/assessments/create-assessment-link"
import { createBatteryInstance } from "@/lib/assessments/create-battery-instance"
import {
  formatAppointmentDate,
  formatAppointmentTime,
  sydneyDatePlusDays,
} from "@/lib/appointments/format"
import {
  resolveAppointmentLocationPhrase,
  resolveAppointmentLocationText,
} from "@/lib/appointments/location"
import { db } from "@/lib/db"
import { getEmailTemplateByKey } from "@/lib/email/template-loader"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { sendQuestionnaireEmail } from "@/lib/email/send-questionnaire-link"
import {
  buildHtmlEmailBody,
  buildResolvedEmailBodies,
  buildResolvedPlainEmailBodies,
  resolveTemplate,
} from "@/lib/email/templates"
import { prepareBatteryEmailDraftFromRow } from "@/lib/appointments/prepare-battery-email"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"

const ACTIVE_STATUSES = ["scheduled", "confirmed"] as const
const COMPLETED_STATUS = "completed"

export type AppointmentAutomationSummary = {
  reminders_sent: number
  batteries_sent: number
  post_session_sent: number
  errors: string[]
}

type EmailTemplateRow = NonNullable<
  Awaited<ReturnType<typeof getEmailTemplateByKey>>
>

export type PreSessionBatteryAppointmentRow = {
  appointmentId: string
  clientId: string
  practiceId: string
  practitionerProfileId: string
  appointmentDate: string
  appointmentTime: string
  location: string | null
  mode: string
  clientEmail: string | null
  commsOptOut: boolean
  preSessionOptOut: boolean
}

export type SendPreSessionBatteryResult =
  | { status: "sent" }
  | { status: "skipped"; reason: "opted_out" | "no_email" }
  | { status: "failed"; error: string }

async function logAppointmentAuditEvent(
  practiceId: string,
  clientId: string,
  appointmentId: string,
  eventType: string,
  metadata?: Record<string, unknown>
) {
  await db.insert(auditEvents).values({
    practiceId,
    clientId,
    eventType,
    entityType: "appointment",
    entityId: appointmentId,
    actorMetadataJson: metadata ?? null,
  })
}

export async function runAppointmentAutomations(): Promise<AppointmentAutomationSummary> {
  const summary: AppointmentAutomationSummary = {
    reminders_sent: 0,
    batteries_sent: 0,
    post_session_sent: 0,
    errors: [],
  }

  const reminderDate = sydneyDatePlusDays(2)
  const batteryDate = sydneyDatePlusDays(1)
  const postSessionDate = sydneyDatePlusDays(-1)

  await processReminders(reminderDate, summary)
  await processPreSessionBatteries(batteryDate, summary)
  await processPostSessionQuestionnaires(postSessionDate, summary)

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
      mode: appointments.mode,
      clientEmail: clients.email,
      clientFirstName: clients.firstName,
      commsOptOut: clients.commsOptOut,
      reminderOptOut: clients.reminderOptOut,
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

  const templateCache = new Map<string, EmailTemplateRow | null>()

  for (const row of rows) {
    if (row.commsOptOut || row.reminderOptOut) {
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.reminder_skipped",
        { reason: "opted_out" }
      )
      continue
    }

    const clientEmail = row.clientEmail?.trim()
    if (!clientEmail) {
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.reminder_skipped",
        { reason: "no_email" }
      )
      continue
    }

    try {
      let template = templateCache.get(row.practiceId)
      if (template === undefined) {
        template = await getEmailTemplateByKey(
          row.practiceId,
          "appointment_reminder"
        )
        templateCache.set(row.practiceId, template)
      }

      if (!template) {
        summary.errors.push(
          `Reminder failed for appointment ${row.appointmentId}: appointment_reminder template not found.`
        )
        await logAppointmentAuditEvent(
          row.practiceId,
          row.clientId,
          row.appointmentId,
          "appointment.reminder_failed",
          { reason: "template_missing" }
        )
        continue
      }

      const emailContext = await getQuestionnaireEmailContext(
        row.practiceId,
        row.practitionerProfileId
      )
      if (!emailContext) {
        summary.errors.push(
          `Reminder failed for appointment ${row.appointmentId}: practice or practitioner not found.`
        )
        await logAppointmentAuditEvent(
          row.practiceId,
          row.clientId,
          row.appointmentId,
          "appointment.reminder_failed",
          { reason: "practitioner_context_missing" }
        )
        continue
      }

      const { subject, htmlBody, textBody } = buildResolvedPlainEmailBodies(
        template.message,
        template.subject,
        {
          client_first_name: row.clientFirstName.trim() || "there",
          practice_name: emailContext.practiceName,
          practitioner_name: emailContext.practitionerName,
          appointment_date: formatAppointmentDate(row.appointmentDate),
          appointment_time: formatAppointmentTime(row.appointmentTime),
          location: resolveAppointmentLocationText(
            row.location,
            emailContext.locationNickname,
            emailContext.practiceAddress,
            emailContext.practiceName
          ),
          appointment_location: resolveAppointmentLocationPhrase(
            row.mode,
            row.location,
            emailContext.locationNickname,
            emailContext.practiceAddress,
            emailContext.practiceName
          ),
        }
      )

      const sendResult = await sendQuestionnaireEmail({
        to: clientEmail,
        cc: template.defaultCc ?? undefined,
        bcc: template.defaultBcc ?? undefined,
        subject,
        htmlBody,
        textBody,
      })

      if (!sendResult.sent) {
        summary.errors.push(
          `Reminder failed for appointment ${row.appointmentId}: ${sendResult.error}`
        )
        await logAppointmentAuditEvent(
          row.practiceId,
          row.clientId,
          row.appointmentId,
          "appointment.reminder_failed",
          { error: sendResult.error }
        )
        continue
      }

      const now = new Date()
      await db.transaction(async (tx) => {
        await tx
          .update(appointments)
          .set({ reminderSentAt: now, updatedAt: now })
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
      const message = error instanceof Error ? error.message : "Unknown error"
      summary.errors.push(
        `Reminder failed for appointment ${row.appointmentId}: ${message}`
      )
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.reminder_failed",
        { error: message }
      )
    }
  }
}

export async function sendPreSessionBatteryForAppointment(
  row: PreSessionBatteryAppointmentRow,
  options: { userId: string | null } = { userId: null }
): Promise<SendPreSessionBatteryResult> {
  const { userId } = options

  const draft = await prepareBatteryEmailDraftFromRow(row)

  if (draft.status === "skipped") {
    await logAppointmentAuditEvent(
      row.practiceId,
      row.clientId,
      row.appointmentId,
      "appointment.pre_session_battery_skipped",
      { reason: draft.reason }
    )
    return draft
  }

  if (draft.status === "failed") {
    await logAppointmentAuditEvent(
      row.practiceId,
      row.clientId,
      row.appointmentId,
      "appointment.pre_session_battery_failed",
      { reason: "template_missing", error: draft.error }
    )
    return { status: "failed", error: draft.error }
  }

  try {
    const treatmentPlan = await loadActiveTreatmentPlanSummary(
      row.clientId,
      row.practiceId
    )
    const assessmentCodes = batteryCodesFromTreatmentPlan(
      treatmentPlan?.ongoingAssessmentsJson,
      treatmentPlan?.behaviouralTargetItems ?? []
    )

    const batteryResult = await createBatteryInstance({
      clientId: row.clientId,
      practiceId: row.practiceId,
      practitionerProfileId: row.practitionerProfileId,
      assessmentCodes,
      userId,
      appointmentId: row.appointmentId,
    })

    if (!batteryResult.ok) {
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.pre_session_battery_failed",
        { error: batteryResult.error }
      )
      return { status: "failed", error: batteryResult.error }
    }

    const template = await getEmailTemplateByKey(
      row.practiceId,
      "pre_session_questionnaire"
    )
    if (!template) {
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.pre_session_battery_failed",
        { reason: "template_missing" }
      )
      return {
        status: "failed",
        error: "pre_session_questionnaire template not found.",
      }
    }

    const htmlBody = buildHtmlEmailBody(
      draft.message,
      batteryResult.link,
      draft.actionButtonLabel
    )
    const textBody = resolveTemplate(draft.message, {
      questionnaire_link: batteryResult.link,
    }).replace(/\n{3,}/g, "\n\n")
    const subject = resolveTemplate(draft.subject, {
      questionnaire_link: batteryResult.link,
    })

    const sendResult = await sendQuestionnaireEmail({
      to: draft.to,
      cc: template.defaultCc ?? undefined,
      bcc: template.defaultBcc ?? undefined,
      subject,
      htmlBody,
      textBody,
    })

    if (!sendResult.sent) {
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.pre_session_battery_failed",
        { error: sendResult.error }
      )
      return { status: "failed", error: sendResult.error }
    }

    const now = new Date()
    await db.transaction(async (tx) => {
      await tx
        .update(appointments)
        .set({ preSessionBatterySentAt: now, updatedAt: now })
        .where(eq(appointments.appointmentId, row.appointmentId))

      await tx.insert(auditEvents).values({
        practiceId: row.practiceId,
        userId,
        clientId: row.clientId,
        eventType: "appointment.pre_session_battery_sent",
        entityType: "appointment",
        entityId: row.appointmentId,
      })
    })

    return { status: "sent" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await logAppointmentAuditEvent(
      row.practiceId,
      row.clientId,
      row.appointmentId,
      "appointment.pre_session_battery_failed",
      { error: message }
    )
    return { status: "failed", error: message }
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
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      location: appointments.location,
      mode: appointments.mode,
      clientEmail: clients.email,
      commsOptOut: clients.commsOptOut,
      preSessionOptOut: clients.preSessionOptOut,
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
    const result = await sendPreSessionBatteryForAppointment(row, { userId: null })

    if (result.status === "sent") {
      summary.batteries_sent += 1
    } else if (result.status === "failed") {
      summary.errors.push(
        `Pre-session battery failed for appointment ${row.appointmentId}: ${result.error}`
      )
    }
    // "skipped" results are already audit-logged inside the function; nothing further to do.
  }
}

async function processPostSessionQuestionnaires(
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
      commsOptOut: clients.commsOptOut,
      postSessionOptOut: clients.postSessionOptOut,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .where(
      and(
        eq(appointments.appointmentDate, targetDate),
        eq(appointments.status, COMPLETED_STATUS),
        isNull(appointments.postSessionSentAt)
      )
    )

  const templateCache = new Map<string, EmailTemplateRow | null>()

  for (const row of rows) {
    if (row.commsOptOut || row.postSessionOptOut) {
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.post_session_skipped",
        { reason: "opted_out" }
      )
      continue
    }

    const clientEmail = row.clientEmail?.trim()
    if (!clientEmail) {
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.post_session_skipped",
        { reason: "no_email" }
      )
      continue
    }

    try {
      let template = templateCache.get(row.practiceId)
      if (template === undefined) {
        template = await getEmailTemplateByKey(row.practiceId, "post_session")
        templateCache.set(row.practiceId, template)
      }

      if (!template) {
        summary.errors.push(
          `Post-session feedback failed for appointment ${row.appointmentId}: post_session template not found.`
        )
        await logAppointmentAuditEvent(
          row.practiceId,
          row.clientId,
          row.appointmentId,
          "appointment.post_session_failed",
          { reason: "template_missing" }
        )
        continue
      }

      const linkResult = await createAssessmentLink({
        clientId: row.clientId,
        practiceId: row.practiceId,
        practitionerProfileId: row.practitionerProfileId,
        assessmentCode: "PSF",
        userId: null,
        appointmentId: row.appointmentId,
      })

      if (!linkResult.ok) {
        summary.errors.push(
          `Post-session feedback failed for appointment ${row.appointmentId}: ${linkResult.error}`
        )
        await logAppointmentAuditEvent(
          row.practiceId,
          row.clientId,
          row.appointmentId,
          "appointment.post_session_failed",
          { error: linkResult.error }
        )
        continue
      }

      const { subject, htmlBody, textBody } = buildResolvedEmailBodies(
        template.message,
        template.subject,
        linkResult.link,
        linkResult.templateVariables,
        template.actionButtonLabel ?? "Share Feedback"
      )

      const sendResult = await sendQuestionnaireEmail({
        to: clientEmail,
        cc: template.defaultCc ?? undefined,
        bcc: template.defaultBcc ?? undefined,
        subject,
        htmlBody,
        textBody,
      })

      if (!sendResult.sent) {
        summary.errors.push(
          `Post-session feedback failed for appointment ${row.appointmentId}: ${sendResult.error}`
        )
        await logAppointmentAuditEvent(
          row.practiceId,
          row.clientId,
          row.appointmentId,
          "appointment.post_session_failed",
          { error: sendResult.error }
        )
        continue
      }

      const now = new Date()
      await db.transaction(async (tx) => {
        await tx
          .update(appointments)
          .set({ postSessionSentAt: now, updatedAt: now })
          .where(eq(appointments.appointmentId, row.appointmentId))

        await tx.insert(auditEvents).values({
          practiceId: row.practiceId,
          clientId: row.clientId,
          eventType: "appointment.post_session_sent",
          entityType: "appointment",
          entityId: row.appointmentId,
        })
      })

      summary.post_session_sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      summary.errors.push(
        `Post-session feedback failed for appointment ${row.appointmentId}: ${message}`
      )
      await logAppointmentAuditEvent(
        row.practiceId,
        row.clientId,
        row.appointmentId,
        "appointment.post_session_failed",
        { error: message }
      )
    }
  }
}
