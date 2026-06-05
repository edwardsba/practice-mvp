import { getResendClient } from "@/lib/email/resend"

const FROM_ADDRESS = "onboarding@resend.dev"

export type SendAppointmentReminderResult =
  | { sent: true }
  | { sent: false; error: string }

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendAppointmentReminderEmail({
  to,
  subject,
  clientFirstName,
  appointmentDate,
  appointmentTime,
  location,
  practitionerName,
  practiceName,
}: {
  to: string
  subject: string
  clientFirstName: string
  appointmentDate: string
  appointmentTime: string
  location: string
  practitionerName: string
  practiceName: string
}): Promise<SendAppointmentReminderResult> {
  const email = to.trim()
  if (!email) {
    return { sent: false, error: "No recipient email address." }
  }

  const locationText = location.trim() || "your scheduled location"
  const textBody = `Hi ${clientFirstName}, this is a reminder that you have an appointment on ${appointmentDate} at ${appointmentTime} at ${locationText}. ${practitionerName}, ${practiceName}`
  const htmlBody = `<p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111111;">Hi ${escapeHtml(clientFirstName)}, this is a reminder that you have an appointment on ${escapeHtml(appointmentDate)} at ${escapeHtml(appointmentTime)} at ${escapeHtml(locationText)}.</p><p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111111;">${escapeHtml(practitionerName)}, ${escapeHtml(practiceName)}</p>`

  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html: htmlBody,
      text: textBody,
    })

    if (error) {
      console.error("Failed to send appointment reminder email:", error)
      return { sent: false, error: error.message ?? "Send failed" }
    }

    return { sent: true }
  } catch (err) {
    console.error("Failed to send appointment reminder email:", err)
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Send failed",
    }
  }
}
