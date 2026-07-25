import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import {
  formatQuestionnaireExpiryDate,
  type QuestionnaireEmailTemplateVariables,
} from "@/lib/email/templates"

export type QuestionnaireLinkApiResponse = {
  link: string
  expires_at: string
  assessmentAccessLinkId: string
  clientEmail: string | null
  templateVariables: QuestionnaireEmailTemplateVariables
}

export function buildTemplateVariablesFromLinkResponse(
  data: {
    clientFirstName: string
    practiceName: string
    practitionerName: string
    expiresAt: Date
    appointmentDate?: string | null
    appointmentTime?: string | null
  }
): QuestionnaireEmailTemplateVariables {
  return {
    client_first_name: data.clientFirstName.trim() || "there",
    practice_name: data.practiceName,
    practitioner_name: data.practitionerName,
    expiry_date: formatQuestionnaireExpiryDate(data.expiresAt),
    ...(data.appointmentDate
      ? { appointment_date: formatAppointmentDate(data.appointmentDate) }
      : {}),
    ...(data.appointmentTime
      ? { appointment_time: formatAppointmentTime(data.appointmentTime) }
      : {}),
  }
}
