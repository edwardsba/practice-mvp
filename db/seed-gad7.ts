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

const RESPONSE_OPTIONS = [
  { label: "Not at all", value: "0", score: 0, order: 1 },
  { label: "Several days", value: "1", score: 1, order: 2 },
  { label: "More than half the days", value: "2", score: 2, order: 3 },
  { label: "Nearly every day", value: "3", score: 3, order: 4 },
] as const

const GAD7_QUESTIONS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
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
    .where(eq(assessmentDefinitions.assessmentCode, "GAD7"))
    .limit(1)

  if (existing) {
    console.log("GAD-7 assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "GAD7",
      assessmentName: "GAD-7",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < GAD7_QUESTIONS.length; i++) {
    const order = i + 1
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `gad7_q${order}`,
        questionText: GAD7_QUESTIONS[i],
        elementType: "radio",
        dataType: "integer",
        displayOrder: order,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("GAD-7 assessment seeded successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("GAD-7 seed failed:", error)
  process.exit(1)
})
