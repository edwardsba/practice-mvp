import { resolveTemplate } from "@/lib/email/templates"

export const DEFAULT_TREATMENT_PLAN_SUBJECT =
  "Your Treatment Plan from {practice_name}"

export const DEFAULT_TREATMENT_PLAN_MESSAGE = `Hi {client_first_name},

Please find your treatment plan attached.

{practitioner_name}
{practice_name}`

export type TreatmentPlanEmailVariables = {
  client_first_name: string
  practice_name: string
  practitioner_name: string
}

export function getDefaultTreatmentPlanEmailDraft(
  variables: TreatmentPlanEmailVariables
): { subject: string; message: string } {
  return {
    subject: resolveTemplate(DEFAULT_TREATMENT_PLAN_SUBJECT, variables),
    message: resolveTemplate(DEFAULT_TREATMENT_PLAN_MESSAGE, variables),
  }
}

export function resolveTreatmentPlanEmail(
  subject: string,
  message: string,
  variables: TreatmentPlanEmailVariables
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
