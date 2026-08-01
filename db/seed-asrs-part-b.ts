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

const ASRS_PART_B_QUESTIONS = [
  { key: "asrs_b_q7", text: "How often do you make careless mistakes when you have to work on a boring or difficult project?", subscale: "inattention" },
  { key: "asrs_b_q8", text: "How often do you have difficulty keeping your attention when you are doing boring or repetitive work?", subscale: "inattention" },
  { key: "asrs_b_q9", text: "How often do you have difficulty concentrating on what people say to you, even when they are speaking to you directly?", subscale: "inattention" },
  { key: "asrs_b_q10", text: "How often do you misplace or have difficulty finding things at home or at work?", subscale: "inattention" },
  { key: "asrs_b_q11", text: "How often are you distracted by activity or noise around you?", subscale: "inattention" },
  { key: "asrs_b_q12", text: "How often do you leave your seat in meetings or other situations in which you are expected to remain seated?", subscale: "hyperactivity" },
  { key: "asrs_b_q13", text: "How often do you feel restless or fidgety?", subscale: "hyperactivity" },
  { key: "asrs_b_q14", text: "How often do you have difficulty unwinding and relaxing when you have time to yourself?", subscale: "hyperactivity" },
  { key: "asrs_b_q15", text: "How often do you find yourself talking too much when you are in social situations?", subscale: "hyperactivity" },
  { key: "asrs_b_q16", text: "When you are in a conversation, how often do you find yourself finishing the sentences of the people you are talking to, before they can finish them themselves?", subscale: "hyperactivity" },
  { key: "asrs_b_q17", text: "How often do you have difficulty waiting your turn in situations when turn taking is required?", subscale: "hyperactivity" },
  { key: "asrs_b_q18", text: "How often do you interrupt others when they are busy?", subscale: "hyperactivity" },
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
    .where(eq(assessmentDefinitions.assessmentCode, "ASRS_PART_B"))
    .limit(1)

  if (existing) {
    console.log("ASRS Part B already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "ASRS_PART_B",
      assessmentName: "ASRS v1.1 — Part B (extension, if Part A triggers)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < ASRS_PART_B_QUESTIONS.length; i++) {
    const order = i + 1
    const question = ASRS_PART_B_QUESTIONS[i]
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

  console.log("ASRS Part B seeded successfully (12 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("ASRS Part B seed failed:", error)
  process.exit(1)
})
