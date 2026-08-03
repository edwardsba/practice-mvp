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

// Unlike most Level 2 measures, each ASRM item is a set of 5 distinct statements (0-4)
// rather than a uniform frequency scale, so per-item response options genuinely differ.
// Scored in the normal direction (higher = more manic/hypomanic symptoms) — NOT reverse
// scored like SCI.
const ASRM_QUESTIONS = [
  {
    text: "Mood",
    options: [
      "I do not feel happier or more cheerful than usual.",
      "I occasionally feel happier or more cheerful than usual.",
      "I often feel happier or more cheerful than usual.",
      "I feel happier or more cheerful than usual most of the time.",
      "I feel happier or more cheerful than usual all of the time.",
    ],
  },
  {
    text: "Self-confidence",
    options: [
      "I do not feel more self-confident than usual.",
      "I occasionally feel more self-confident than usual.",
      "I often feel more self-confident than usual.",
      "I frequently feel more self-confident than usual.",
      "I feel extremely self-confident all of the time.",
    ],
  },
  {
    text: "Sleep",
    options: [
      "I do not need less sleep than usual.",
      "I occasionally need less sleep than usual.",
      "I often need less sleep than usual.",
      "I frequently need less sleep than usual.",
      "I can go all day and all night without any sleep and still not feel tired.",
    ],
  },
  {
    text: "Speech",
    options: [
      "I do not talk more than usual.",
      "I occasionally talk more than usual.",
      "I often talk more than usual.",
      "I frequently talk more than usual.",
      "I talk constantly and cannot be interrupted.",
    ],
  },
  {
    text: "Activity level",
    options: [
      "I have not been more active (socially, sexually, at work, home, or school) than usual.",
      "I have occasionally been more active than usual.",
      "I have often been more active than usual.",
      "I have frequently been more active than usual.",
      "I am constantly more active or on the go all the time.",
    ],
  },
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
    .where(eq(assessmentDefinitions.assessmentCode, "ASRM"))
    .limit(1)

  if (existing) {
    console.log("ASRM assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "ASRM",
      assessmentName: "Altman Self-Rating Mania Scale (ASRM)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < ASRM_QUESTIONS.length; i++) {
    const question = ASRM_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `asrm_q${i + 1}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
        groupLabel: "Mania",
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      question.options.map((label, optionIndex) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: label,
        optionValue: String(optionIndex),
        scoreValue: optionIndex,
        displayOrder: optionIndex + 1,
      }))
    )
  }

  console.log("ASRM assessment seeded successfully (5 items, per-item response options).")
  await pool.end()
}

main().catch((error) => {
  console.error("ASRM seed failed:", error)
  process.exit(1)
})
