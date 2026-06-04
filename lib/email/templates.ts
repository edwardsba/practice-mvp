export const QUESTIONNAIRE_LINK_VARIABLE = "{questionnaire_link}"

export const DEFAULT_QUESTIONNAIRE_SUBJECT =
  "Your pre-session questionnaire from {practice_name}"

export const DEFAULT_QUESTIONNAIRE_MESSAGE = `Hi {client_first_name},

Please complete your pre-session questionnaire before your next appointment.

{questionnaire_link}

This link expires on {expiry_date}.

{practitioner_name}
{practice_name}`

export const EMAIL_TEMPLATE_VARIABLE_CHIPS = [
  { variable: "{client_first_name}", label: "Client first name" },
  { variable: "{practice_name}", label: "Practice name" },
  { variable: "{practitioner_name}", label: "Practitioner name" },
  { variable: QUESTIONNAIRE_LINK_VARIABLE, label: "Questionnaire button" },
  { variable: "{expiry_date}", label: "Expiry date" },
] as const

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

export function buildQuestionnaireLinkButtonHtml(linkUrl: string): string {
  const href = escapeHtmlAttr(linkUrl)
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
  <tr>
    <td align="center" bgcolor="#1a1a1a" style="border-radius:6px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#1a1a1a;">Complete Questionnaire &rarr;</a>
    </td>
  </tr>
</table>`
}

export function buildHtmlEmailBody(message: string, linkUrl: string): string {
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
      contentParts.push(buildQuestionnaireLinkButtonHtml(linkUrl))
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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
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

export function buildResolvedEmailBodies(
  message: string,
  subject: string,
  linkUrl: string,
  variables: QuestionnaireEmailTemplateVariables
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
    htmlBody: buildHtmlEmailBody(htmlMessage, linkUrl),
    textBody,
  }
}
