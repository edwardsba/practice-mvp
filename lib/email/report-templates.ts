import { resolveTemplate } from "@/lib/email/templates"

export const DEFAULT_REPORT_SUBJECT =
  "{report_title} — {client_name} from {practice_name}"

export const DEFAULT_REPORT_MESSAGE = `Dear {recipient_name},

Please find the attached {report_title_lower} for {client_name}.

Kind regards,
{practitioner_name}
{practice_name}`

export type ReportEmailVariables = {
  recipient_name: string
  client_name: string
  report_title: string
  report_title_lower: string
  practice_name: string
  practitioner_name: string
}

export function getDefaultReportEmailDraft(variables: ReportEmailVariables) {
  return {
    subject: resolveTemplate(DEFAULT_REPORT_SUBJECT, variables),
    message: resolveTemplate(DEFAULT_REPORT_MESSAGE, variables),
  }
}

export function resolveReportEmail(
  subject: string,
  message: string,
  variables: ReportEmailVariables
) {
  const resolvedMessage = resolveTemplate(message, variables)
  return {
    subject: resolveTemplate(subject, variables),
    textBody: resolvedMessage,
    htmlBody: resolvedMessage
      .split("\n\n")
      .map(
        (paragraph) =>
          `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111111;">${paragraph
            .split("\n")
            .join("<br />")}</p>`
      )
      .join(""),
  }
}
