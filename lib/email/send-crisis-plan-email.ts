import { getResendClient } from "@/lib/email/resend"

const FROM_ADDRESS = "onboarding@resend.dev"

export type SendCrisisPlanEmailResult =
  | { sent: true }
  | { sent: false; error: string }

export async function sendCrisisPlanEmail({
  to,
  subject,
  htmlBody,
  textBody,
  pdfBuffer,
  filename,
}: {
  to: string
  subject: string
  htmlBody: string
  textBody: string
  pdfBuffer: Buffer
  filename: string
}): Promise<SendCrisisPlanEmailResult> {
  const email = to.trim()
  if (!email) {
    return { sent: false, error: "No recipient email address." }
  }

  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html: htmlBody,
      text: textBody,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    })

    if (error) {
      console.error("Failed to send crisis plan email:", error)
      return { sent: false, error: error.message ?? "Send failed" }
    }

    return { sent: true }
  } catch (err) {
    console.error("Failed to send crisis plan email:", err)
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Send failed",
    }
  }
}
