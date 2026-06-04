import { getResendClient } from "@/lib/email/resend"

const FROM_ADDRESS = "onboarding@resend.dev"
const SUBJECT = "Your questionnaire from Benjamin Edwards Psychology"

export type SendQuestionnaireLinkResult =
  | { sent: true }
  | { sent: false; reason: "no_email" }
  | { sent: false; reason: "send_failed" }

function formatExpiryDate(expiresAt: Date): string {
  return expiresAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function buildPlainTextBody(
  clientFirstName: string,
  linkUrl: string,
  expiresAt: Date
): string {
  const greetingName = clientFirstName.trim() || "there"
  const expiryFormatted = formatExpiryDate(expiresAt)

  return `Hi ${greetingName},

Please complete your pre-session questionnaire before your next appointment.

${linkUrl}

This link expires on ${expiryFormatted}.

Benjamin Edwards, Benjamin Edwards Psychology`
}

export async function sendQuestionnaireLinkEmail({
  to,
  clientFirstName,
  linkUrl,
  expiresAt,
}: {
  to: string | null | undefined
  clientFirstName: string
  linkUrl: string
  expiresAt: Date
}): Promise<SendQuestionnaireLinkResult> {
  const email = to?.trim()
  if (!email) {
    return { sent: false, reason: "no_email" }
  }

  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: SUBJECT,
      text: buildPlainTextBody(clientFirstName, linkUrl, expiresAt),
    })

    if (error) {
      console.error("Failed to send questionnaire link email:", error)
      return { sent: false, reason: "send_failed" }
    }

    return { sent: true }
  } catch (err) {
    console.error("Failed to send questionnaire link email:", err)
    return { sent: false, reason: "send_failed" }
  }
}
