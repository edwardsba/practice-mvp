import { resolveTemplate } from "@/lib/email/templates"

export const DEFAULT_CRISIS_PLAN_SUBJECT =
  "Your Crisis Plan from {practice_name}"

export const DEFAULT_CRISIS_PLAN_MESSAGE = `Hi {client_first_name},

Please find your crisis plan attached.

{practitioner_name}
{practice_name}`

export type CrisisPlanEmailVariables = {
  client_first_name: string
  practice_name: string
  practitioner_name: string
}

export function getDefaultCrisisPlanEmailDraft(
  variables: CrisisPlanEmailVariables
): { subject: string; message: string } {
  return {
    subject: resolveTemplate(DEFAULT_CRISIS_PLAN_SUBJECT, variables),
    message: resolveTemplate(DEFAULT_CRISIS_PLAN_MESSAGE, variables),
  }
}

export function resolveCrisisPlanEmail(
  subject: string,
  message: string,
  variables: CrisisPlanEmailVariables
) {
  return {
    subject: resolveTemplate(subject, variables),
    textBody: resolveTemplate(message, variables),
    htmlBody: resolveTemplate(message, variables)
      .split("\n\n")
      .map((paragraph) => {
        const lines = paragraph.split("\n").join("<br />")
        return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111111;">${lines}</p>`
      })
      .join(""),
  }
}
