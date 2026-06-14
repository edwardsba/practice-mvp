import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  DEFAULT_QUESTIONNAIRE_MESSAGE,
  DEFAULT_QUESTIONNAIRE_SUBJECT,
} from "../lib/email/templates"
import { emailTemplates, practices } from "./schema"

config({ path: ".env.local" })

const SEED_TEMPLATES = [
  {
    templateKey: "send_assessment",
    name: "Send Assessment",
    subject: DEFAULT_QUESTIONNAIRE_SUBJECT,
    message: DEFAULT_QUESTIONNAIRE_MESSAGE,
    defaultCc: null as string | null,
    defaultBcc: null as string | null,
    hasActionButton: true,
    actionButtonLabel: "Complete Questionnaire",
  },
  {
    templateKey: "ad_hoc",
    name: "Ad hoc",
    subject: "",
    message: "",
    defaultCc: null as string | null,
    defaultBcc: null as string | null,
    hasActionButton: false,
    actionButtonLabel: null as string | null,
  },
  {
    templateKey: "appointment_reminder",
    name: "Appointment Reminder",
    subject: "Appointment reminder from {practice_name}",
    message: `Hi {client_first_name},

This is a reminder that you have an appointment on {appointment_date} at {appointment_time} at {location}.

{practitioner_name}
{practice_name}`,
    defaultCc: null as string | null,
    defaultBcc: null as string | null,
    hasActionButton: false,
    actionButtonLabel: null as string | null,
  },
  {
    templateKey: "pre_session_questionnaire",
    name: "Pre-Session Questionnaire",
    subject: DEFAULT_QUESTIONNAIRE_SUBJECT,
    message: DEFAULT_QUESTIONNAIRE_MESSAGE,
    defaultCc: null as string | null,
    defaultBcc: null as string | null,
    hasActionButton: true,
    actionButtonLabel: "Complete Questionnaire",
  },
  {
    templateKey: "post_session",
    name: "Post-Session Feedback",
    subject: "How was your session? — {practice_name}",
    message: `Hi {client_first_name},

Thank you for coming in. We'd really appreciate a couple of minutes of your feedback about the session.

{questionnaire_link}

{practitioner_name}
{practice_name}`,
    defaultCc: null as string | null,
    defaultBcc: null as string | null,
    hasActionButton: true,
    actionButtonLabel: "Share Feedback",
  },
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)
  const now = new Date()

  const [practice] = await db
    .select({ practiceId: practices.practiceId })
    .from(practices)
    .where(eq(practices.isActive, true))
    .limit(1)

  if (!practice) {
    throw new Error("No active practice found.")
  }

  const practiceId = practice.practiceId

  for (const seed of SEED_TEMPLATES) {
    const [existing] = await db
      .select({ emailTemplateId: emailTemplates.emailTemplateId })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.practiceId, practiceId),
          eq(emailTemplates.templateKey, seed.templateKey)
        )
      )
      .limit(1)

    if (existing) {
      console.log(`Email template already exists, skipping: ${seed.name}`)
      continue
    }

    await db.insert(emailTemplates).values({
      practiceId,
      templateKey: seed.templateKey,
      name: seed.name,
      subject: seed.subject,
      message: seed.message,
      defaultCc: seed.defaultCc,
      defaultBcc: seed.defaultBcc,
      hasActionButton: seed.hasActionButton,
      actionButtonLabel: seed.actionButtonLabel,
      updatedAt: now,
    })
    console.log(`Created email template: ${seed.name}`)
  }

  await pool.end()
  console.log("Email templates seed completed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
