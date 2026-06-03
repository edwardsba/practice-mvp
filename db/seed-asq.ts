import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "./schema"

config({ path: ".env.local" })

const ASQ_QUESTIONS = [
  {
    key: "asq_q1",
    order: 1,
    text: "In the past few weeks, have you wished you were dead?",
  },
  {
    key: "asq_q2",
    order: 2,
    text: "In the past few weeks, have you felt that you or your family would be better off if you were dead?",
  },
  {
    key: "asq_q3",
    order: 3,
    text: "In the past week, have you been having thoughts about killing yourself?",
  },
  {
    key: "asq_q4",
    order: 4,
    text: "Have you ever tried to kill yourself?",
  },
  {
    key: "asq_q5",
    order: 5,
    text: "Are you having thoughts of killing yourself right now?",
  },
] as const

const YES_NO_OPTIONS = [
  { label: "Yes", value: "yes", score: 1, order: 1 },
  { label: "No", value: "no", score: 0, order: 2 },
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const [existing] = await db
    .select({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "ASQ"))
    .limit(1)

  if (existing) {
    console.log("ASQ assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "ASQ",
      assessmentName: "ASQ",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: false,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (const question of ASQ_QUESTIONS) {
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: question.key,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: question.order,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      YES_NO_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("ASQ assessment seeded successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("ASQ seed failed:", error)
  process.exit(1)
})
