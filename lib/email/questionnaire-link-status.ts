export type QuestionnaireLinkEmailReason = "no_email" | "send_failed"

export function getQuestionnaireLinkEmailStatusMessage(
  emailSent: boolean,
  emailReason: QuestionnaireLinkEmailReason | undefined,
  clientEmail: string | null | undefined
): string | null {
  if (emailSent && clientEmail) {
    return `Link generated and emailed to ${clientEmail}`
  }
  if (emailReason === "no_email") {
    return "Link generated. No email address on file — copy the link below and send manually."
  }
  if (emailReason === "send_failed") {
    return "Link generated but email failed to send — copy the link below and send manually."
  }
  return null
}
