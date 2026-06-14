import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "./schema"
import { PSQ_RESPONSE_OPTIONS } from "./seed-shared"

config({ path: ".env.local" })

const PSQ_QUESTIONS = [
  "I am clearer about my therapeutic goals or how to achieve them",
  "I am making progress in my therapy, I have new solutions to my problem, or more hope",
  "I feel understood, supported, reassured, validated, or encouraged",
  "I feel better after the session",
  "I see value in the therapy, I am engaged in my recovery",
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
    .where(eq(assessmentDefinitions.assessmentCode, "PSQ"))
    .limit(1)

  if (existing) {
    console.log("PSQ assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "PSQ",
      assessmentName: "Post-Session Questionnaire",
      assessmentType: "psychometric_assessment",
      description:
        "As a result of this session... Please choose the answer that best describes you.",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: false,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < PSQ_QUESTIONS.length; i++) {
    const order = i + 1
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `psq_q${order}`,
        questionText: PSQ_QUESTIONS[i],
        elementType: "radio",
        dataType: "integer",
        displayOrder: order,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      PSQ_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("PSQ assessment seeded successfully (5 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("PSQ seed failed:", error)
  process.exit(1)
})
