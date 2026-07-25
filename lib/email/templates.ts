export const QUESTIONNAIRE_LINK_VARIABLE = "{questionnaire_link}"

export const SYSTEM_LINK_TEMPLATE_KEYS: string[] = [
  "send_assessment",
  "pre_session_questionnaire",
  "post_session",
]

export const NO_ACTION_BUTTON_TEMPLATE_KEYS: string[] = [
  "appointment_reminder",
]

export const PROTECTED_TEMPLATE_KEYS: string[] = [
  "send_assessment",
  "ad_hoc",
  "appointment_reminder",
  "pre_session_questionnaire",
  "post_session",
]

export const EXCLUDED_FROM_MANUAL_SEND_TEMPLATE_KEYS: string[] = [
  "appointment_reminder",
  "pre_session_questionnaire",
  "post_session",
]

export const DEFAULT_QUESTIONNAIRE_SUBJECT =
  "Your pre-session questionnaire from {practice_name}"

export const DEFAULT_QUESTIONNAIRE_MESSAGE = `Hi {client_first_name},

Please complete your pre-session questionnaire before your next appointment.

{questionnaire_link}

This link expires on {expiry_date}.

{practitioner_name}
{practice_name}`

export const APPOINTMENT_CONTEXT_EXCLUDED_TEMPLATE_KEYS: string[] = [
  "ad_hoc",
]

export type EmailVariableAvailability =
  | "always"
  | "action_button"
  | "appointment_context"

export type EmailTemplateVariableChip = {
  variable: string
  label: string
  description: string
  example: string
  availability: EmailVariableAvailability
}

export const EMAIL_TEMPLATE_VARIABLE_CHIPS: EmailTemplateVariableChip[] = [
  {
    variable: "{client_first_name}",
    label: "Client first name",
    description: "The client's first name.",
    example: "Sarah",
    availability: "always",
  },
  {
    variable: "{practice_name}",
    label: "Practice name",
    description: "Your practice's name.",
    example: "Mindful Psychology",
    availability: "always",
  },
  {
    variable: "{practitioner_name}",
    label: "Practitioner name",
    description: "The practitioner's name as shown to clients.",
    example: "Dr Jane Smith",
    availability: "always",
  },
  {
    variable: QUESTIONNAIRE_LINK_VARIABLE,
    label: "Questionnaire button",
    description: "Inserts a button linking to the questionnaire or assessment.",
    example: "Complete Questionnaire →",
    availability: "action_button",
  },
  {
    variable: "{expiry_date}",
    label: "Expiry date",
    description: "The date the questionnaire or assessment link expires.",
    example: "21 June 2026",
    availability: "action_button",
  },
  {
    variable: "{appointment_date}",
    label: "Appointment date",
    description: "The date of the client's appointment.",
    example: "Mon, 15 Jun 2026",
    availability: "appointment_context",
  },
  {
    variable: "{appointment_time}",
    label: "Appointment time",
    description: "The time of the client's appointment.",
    example: "2:30 PM",
    availability: "appointment_context",
  },
  {
    variable: "{location}",
    label: "Location",
    description:
      'The appointment\'s location. Falls back to the practice address, then the practice name, if left blank on the appointment. For online appointments, consider using {appointment_location} instead.',
    example: "Suite 4, 123 Smith Street",
    availability: "appointment_context",
  },
  {
    variable: "{appointment_location}",
    label: "Appointment location",
    description:
      "A complete phrase describing where the appointment takes place — 'in person at [address]' for face-to-face appointments, or a note about the online session for online appointments. Designed for sentences like 'This appointment is {appointment_location}.'",
    example: "in person at 12 Junction Street, Woollahra NSW 2027",
    availability: "appointment_context",
  },
]

export function formatQuestionnaireExpiryDate(expiresAt: Date): string {
  return expiresAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function resolveTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = key.startsWith("{") ? key : `{${key}}`
    result = result.split(placeholder).join(value)
  }
  return result
}

export type QuestionnaireEmailTemplateVariables = {
  client_first_name: string
  practice_name: string
  practitioner_name: string
  expiry_date: string
  appointment_date?: string
  appointment_time?: string
}

export function getDefaultEmailDraft(
  variables: QuestionnaireEmailTemplateVariables
): { subject: string; message: string } {
  return {
    subject: resolveTemplate(DEFAULT_QUESTIONNAIRE_SUBJECT, variables),
    message: resolveTemplate(DEFAULT_QUESTIONNAIRE_MESSAGE, {
      ...variables,
      questionnaire_link: QUESTIONNAIRE_LINK_VARIABLE,
    }),
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeHtmlAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, "&#39;")
}

export function buildQuestionnaireLinkButtonHtml(
  linkUrl: string,
  label = "Complete Questionnaire"
): string {
  const href = escapeHtmlAttr(linkUrl)
  const buttonLabel = escapeHtml(label)
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
  <tr>
    <td align="center" bgcolor="#1a1a1a" style="border-radius:6px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#1a1a1a;">${buttonLabel} &rarr;</a>
    </td>
  </tr>
</table>`
}

export function buildHtmlEmailBody(
  message: string,
  linkUrl: string,
  buttonLabel = "Complete Questionnaire"
): string {
  const parts = message.split(QUESTIONNAIRE_LINK_VARIABLE)
  const contentParts: string[] = []

  for (let i = 0; i < parts.length; i++) {
    const text = parts[i] ?? ""
    if (text) {
      const paragraphs = escapeHtml(text).split(/\n\n+/)
      for (const paragraph of paragraphs) {
        const lines = paragraph.split("\n").join("<br />")
        contentParts.push(
          `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111111;">${lines}</p>`
        )
      }
    }
    if (i < parts.length - 1) {
      contentParts.push(buildQuestionnaireLinkButtonHtml(linkUrl, buttonLabel))
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Questionnaire</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px;width:100%;margin:0 auto;">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;color:#111111;">
              ${contentParts.join("")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildPlainTextBody(message: string, linkUrl: string): string {
  return resolveTemplate(message, { questionnaire_link: linkUrl }).replace(
    /\n{3,}/g,
    "\n\n"
  )
}

export function buildAdHocHtmlEmailBody(message: string): string {
  const paragraphs = message.split(/\n\n+/)
  const contentParts = paragraphs
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => {
      const lines = escapeHtml(paragraph).split("\n").join("<br />")
      return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111111;">${lines}</p>`
    })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px;width:100%;margin:0 auto;">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;color:#111111;">
              ${contentParts.join("")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildResolvedEmailBodies(
  message: string,
  subject: string,
  linkUrl: string,
  variables: Record<string, string>,
  buttonLabel = "Complete Questionnaire"
): { subject: string; htmlBody: string; textBody: string } {
  const resolvedVars: Record<string, string> = { ...variables }
  const subjectResolved = resolveTemplate(subject, {
    ...resolvedVars,
    questionnaire_link: linkUrl,
  })
  const htmlMessage = resolveTemplate(message, {
    ...resolvedVars,
    questionnaire_link: QUESTIONNAIRE_LINK_VARIABLE,
  })
  const textBody = resolveTemplate(message, {
    ...resolvedVars,
    questionnaire_link: linkUrl,
  }).replace(/\n{3,}/g, "\n\n")

  return {
    subject: subjectResolved,
    htmlBody: buildHtmlEmailBody(htmlMessage, linkUrl, buttonLabel),
    textBody,
  }
}

export function buildResolvedPlainEmailBodies(
  message: string,
  subject: string,
  variables: Record<string, string>
): { subject: string; htmlBody: string; textBody: string } {
  const resolvedSubject = resolveTemplate(subject, variables)
  const resolvedMessage = resolveTemplate(message, variables)
  return {
    subject: resolvedSubject,
    htmlBody: buildAdHocHtmlEmailBody(resolvedMessage),
    textBody: resolvedMessage.replace(/\n{3,}/g, "\n\n"),
  }
}
