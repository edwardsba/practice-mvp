import { Resend } from "resend"

export const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? "onboarding@resend.dev"

let client: Resend | null = null

export function getResendClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set")
    }
    client = new Resend(apiKey)
  }
  return client
}
