import { FROM_ADDRESS, getResendClient } from "@/lib/email/resend"

export type SendQuestionnaireEmailResult =
  | { sent: true }
  | { sent: false; error: string }

export async function sendQuestionnaireEmail({
  to,
  cc,
  bcc,
  subject,
  htmlBody,
  textBody,
}: {
  to: string
  cc?: string
  bcc?: string
  subject: string
  htmlBody: string
  textBody: string
}): Promise<SendQuestionnaireEmailResult> {
  const email = to.trim()
  if (!email) {
    return { sent: false, error: "No recipient email address." }
  }

  const ccEmail = cc?.trim()
  const bccEmail = bcc?.trim()

  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      ...(ccEmail ? { cc: ccEmail } : {}),
      ...(bccEmail ? { bcc: bccEmail } : {}),
      subject,
      html: htmlBody,
      text: textBody,
    })

    if (error) {
      console.error("Failed to send questionnaire email:", error)
      return { sent: false, error: error.message ?? "Send failed" }
    }

    return { sent: true }
  } catch (err) {
    console.error("Failed to send questionnaire email:", err)
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Send failed",
    }
  }
}
