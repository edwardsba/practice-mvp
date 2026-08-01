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

const ASRS_PART_A_QUESTIONS = [
  { key: "asrs_a_q1", text: "How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?", subscale: "inattention" },
  { key: "asrs_a_q2", text: "How often do you have difficulty getting things in order when you have to do a task that requires organization?", subscale: "inattention" },
  { key: "asrs_a_q3", text: "How often do you have problems remembering appointments or obligations?", subscale: "inattention" },
  { key: "asrs_a_q4", text: "When you have a task that requires a lot of thought, how often do you avoid or delay getting started?", subscale: "inattention" },
  { key: "asrs_a_q5", text: "How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?", subscale: "hyperactivity" },
  { key: "asrs_a_q6", text: "How often do you feel overly active and compelled to do things, like you were driven by a motor?", subscale: "hyperactivity" },
] as const

const ASRS_RESPONSE_OPTIONS = [
  { label: "Never", value: "1", score: 1, order: 1 },
  { label: "Rarely", value: "2", score: 2, order: 2 },
  { label: "Sometimes", value: "3", score: 3, order: 3 },
  { label: "Often", value: "4", score: 4, order: 4 },
  { label: "Very Often", value: "5", score: 5, order: 5 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "ASRS_PART_A"))
    .limit(1)

  if (existing) {
    console.log("ASRS Part A already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "ASRS_PART_A",
      assessmentName: "ASRS v1.1 — Part A (Tier 1 baseline)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < ASRS_PART_A_QUESTIONS.length; i++) {
    const order = i + 1
    const question = ASRS_PART_A_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: question.key,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: order,
        isRequired: true,
        isActive: true,
        groupLabel: question.subscale,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      ASRS_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("ASRS Part A seeded successfully (6 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("ASRS Part A seed failed:", error)
  process.exit(1)
})
