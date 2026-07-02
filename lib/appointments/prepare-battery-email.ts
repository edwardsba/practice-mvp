import { and, eq } from "drizzle-orm"

import { appointments, auditEvents, clients } from "@/db/schema"
import { batteryCodesFromTreatmentPlan } from "@/lib/assessments/battery-defaults"
import { createBatteryInstance } from "@/lib/assessments/create-battery-instance"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import type { PreSessionBatteryAppointmentRow } from "@/lib/appointments/run-automations"
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
  formatQuestionnaireExpiryDate,
  QUESTIONNAIRE_LINK_VARIABLE,
  resolveTemplate,
} from "@/lib/email/templates"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"

export type PrepareBatteryEmailDraftResult =
  | {
      status: "ready"
      to: string
      subject: string
      message: string
      actionButtonLabel: string
    }
  | { status: "skipped"; reason: "opted_out" | "no_email" }
  | { status: "failed"; error: string }

export type SendBatteryEmailResult =
  | { status: "sent" }
  | { status: "skipped"; reason: "opted_out" | "no_email" }
  | { status: "failed"; error: string }

async function loadPreSessionBatteryAppointmentRow(
  appointmentId: string,
  practiceId: string
): Promise<PreSessionBatteryAppointmentRow | null> {
  const [row] = await db
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
        eq(appointments.appointmentId, appointmentId),
        eq(appointments.practiceId, practiceId)
      )
    )
    .limit(1)

  return row ?? null
}

async function loadClientFirstName(clientId: string, practiceId: string) {
  const [client] = await db
    .select({ firstName: clients.firstName })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, practiceId)
      )
    )
    .limit(1)

  return client?.firstName?.trim() || "there"
}

export async function prepareBatteryEmailDraft(
  appointmentId: string,
  practiceId: string
): Promise<PrepareBatteryEmailDraftResult> {
  const row = await loadPreSessionBatteryAppointmentRow(appointmentId, practiceId)
  if (!row) {
    return { status: "failed", error: "Appointment not found." }
  }

  return prepareBatteryEmailDraftFromRow(row)
}

export async function prepareBatteryEmailDraftFromRow(
  row: PreSessionBatteryAppointmentRow
): Promise<PrepareBatteryEmailDraftResult> {
  if (row.commsOptOut || row.preSessionOptOut) {
    return { status: "skipped", reason: "opted_out" }
  }

  const clientEmail = row.clientEmail?.trim()
  if (!clientEmail) {
    return { status: "skipped", reason: "no_email" }
  }

  try {
    const template = await getEmailTemplateByKey(
      row.practiceId,
      "pre_session_questionnaire"
    )
    if (!template) {
      return {
        status: "failed",
        error: "pre_session_questionnaire template not found.",
      }
    }

    const emailContext = await getQuestionnaireEmailContext(
      row.practiceId,
      row.practitionerProfileId
    )
    if (!emailContext) {
      return { status: "failed", error: "Practice or practitioner not found." }
    }

    const clientFirstName = await loadClientFirstName(row.clientId, row.practiceId)
    const previewExpiryDate = formatQuestionnaireExpiryDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    )

    const variables = {
      client_first_name: clientFirstName,
      practice_name: emailContext.practiceName,
      practitioner_name: emailContext.practitionerName,
      expiry_date: previewExpiryDate,
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

    const subject = resolveTemplate(template.subject, {
      ...variables,
      questionnaire_link: QUESTIONNAIRE_LINK_VARIABLE,
    })
    const message = resolveTemplate(template.message, {
      ...variables,
      questionnaire_link: QUESTIONNAIRE_LINK_VARIABLE,
    })

    return {
      status: "ready",
      to: clientEmail,
      subject,
      message,
      actionButtonLabel: template.actionButtonLabel ?? "Complete Questionnaire",
    }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function sendBatteryEmailWithDraft(
  appointmentId: string,
  practiceId: string,
  userId: string | null,
  subject: string,
  message: string
): Promise<SendBatteryEmailResult> {
  const row = await loadPreSessionBatteryAppointmentRow(appointmentId, practiceId)
  if (!row) {
    return { status: "failed", error: "Appointment not found." }
  }

  if (row.commsOptOut || row.preSessionOptOut) {
    return { status: "skipped", reason: "opted_out" }
  }

  const clientEmail = row.clientEmail?.trim()
  if (!clientEmail) {
    return { status: "skipped", reason: "no_email" }
  }

  try {
    const template = await getEmailTemplateByKey(
      row.practiceId,
      "pre_session_questionnaire"
    )
    if (!template) {
      return {
        status: "failed",
        error: "pre_session_questionnaire template not found.",
      }
    }

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
      return { status: "failed", error: batteryResult.error }
    }

    const buttonLabel = template.actionButtonLabel ?? "Complete Questionnaire"
    const htmlBody = buildHtmlEmailBody(message, batteryResult.link, buttonLabel)
    const textBody = resolveTemplate(message, {
      questionnaire_link: batteryResult.link,
    }).replace(/\n{3,}/g, "\n\n")

    const sendResult = await sendQuestionnaireEmail({
      to: clientEmail,
      cc: template.defaultCc ?? undefined,
      bcc: template.defaultBcc ?? undefined,
      subject,
      htmlBody,
      textBody,
    })

    if (!sendResult.sent) {
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
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
