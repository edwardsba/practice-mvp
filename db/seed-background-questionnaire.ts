import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { BACKGROUND_ASSESSMENT_CODE } from "../lib/background-questionnaire/types"
import {
  BACKGROUND_QUESTIONNAIRE_TEMPLATE_KEY,
  DEFAULT_BACKGROUND_QUESTIONNAIRE_BUTTON_LABEL,
  DEFAULT_BACKGROUND_QUESTIONNAIRE_MESSAGE,
  DEFAULT_BACKGROUND_QUESTIONNAIRE_NAME,
  DEFAULT_BACKGROUND_QUESTIONNAIRE_SUBJECT,
} from "../lib/email/templates"
import { assessmentDefinitions, emailTemplates, practices } from "./schema"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)
  const now = new Date()

  const [existingDefinition] = await db
    .select({ id: assessmentDefinitions.assessmentDefinitionId })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, BACKGROUND_ASSESSMENT_CODE))
    .limit(1)

  if (existingDefinition) {
    console.log("Assessment definition already present.")
  } else {
    await db.insert(assessmentDefinitions).values({
      assessmentCode: BACKGROUND_ASSESSMENT_CODE,
      assessmentName: "Background questionnaire (client self-report)",
      clientDisplayName: "Background questionnaire",
      assessmentType: "client_self_report",
      scoringEnabled: false,
      clientCompletable: true,
      practitionerCompletable: false,
    })
    console.log("Assessment definition created.")
  }

  const practiceRows = await db
    .select({ practiceId: practices.practiceId })
    .from(practices)

  let added = 0
  let alreadyPresent = 0

  for (const practice of practiceRows) {
    const [existingTemplate] = await db
      .select({ emailTemplateId: emailTemplates.emailTemplateId })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.practiceId, practice.practiceId),
          eq(emailTemplates.templateKey, BACKGROUND_QUESTIONNAIRE_TEMPLATE_KEY)
        )
      )
      .limit(1)

    if (existingTemplate) {
      alreadyPresent++
      continue
    }

    await db.insert(emailTemplates).values({
      practiceId: practice.practiceId,
      templateKey: BACKGROUND_QUESTIONNAIRE_TEMPLATE_KEY,
      name: DEFAULT_BACKGROUND_QUESTIONNAIRE_NAME,
      subject: DEFAULT_BACKGROUND_QUESTIONNAIRE_SUBJECT,
      message: DEFAULT_BACKGROUND_QUESTIONNAIRE_MESSAGE,
      defaultCc: null,
      defaultBcc: null,
      hasActionButton: true,
      actionButtonLabel: DEFAULT_BACKGROUND_QUESTIONNAIRE_BUTTON_LABEL,
      updatedAt: now,
    })
    added++
  }

  console.log(
    `Background questionnaire email template added for ${added} practice${added === 1 ? "" : "s"} (${alreadyPresent} already had it).`
  )

  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
