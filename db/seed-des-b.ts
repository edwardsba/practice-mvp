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

const DES_B_QUESTIONS = [
  "I find myself staring into space and thinking of nothing.",
  "People, objects, or the world around me seem strange or unreal.",
  "I find that I did things that I do not remember doing.",
  "When I am alone, I talk out loud to myself.",
  "I feel as though I were looking at the world through a fog so that people and things seem far away or unclear.",
  "I am able to ignore pain.",
  "I act so differently from one situation to another that it is almost as if I were two different people.",
  "I can do things very easily that would usually be hard for me.",
] as const

const DES_B_RESPONSE_OPTIONS = [
  { label: "Not at all", value: "0", score: 0, order: 1 },
  { label: "Once or twice", value: "1", score: 1, order: 2 },
  { label: "Almost every day", value: "2", score: 2, order: 3 },
  { label: "About once a day", value: "3", score: 3, order: 4 },
  { label: "More than once a day", value: "4", score: 4, order: 5 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "DES_B"))
    .limit(1)

  if (existing) {
    console.log("DES-B assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "DES_B",
      assessmentName: "Severity of Dissociative Symptoms - Adult (Brief Dissociative Experiences Scale, DES-B - Modified)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < DES_B_QUESTIONS.length; i++) {
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `des_b_q${i + 1}`,
        questionText: DES_B_QUESTIONS[i],
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
        groupLabel: "Dissociative Symptoms",
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      DES_B_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("DES-B assessment seeded successfully (8 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("DES-B seed failed:", error)
  process.exit(1)
})
