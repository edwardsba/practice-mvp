import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "./schema"
import {
  IMPAIRMENT_OPTIONS,
  IMPAIRMENT_QUESTION_TEXT,
  LIKERT_RESPONSE_OPTIONS,
} from "./seed-shared"

config({ path: ".env.local" })

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead, or of hurting yourself",
] as const

async function insertLikertQuestions(
  db: ReturnType<typeof drizzle>,
  definitionId: string,
  prefix: string,
  questions: readonly string[]
) {
  for (let i = 0; i < questions.length; i++) {
    const order = i + 1
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definitionId,
        elementKey: `${prefix}_q${order}`,
        questionText: questions[i],
        elementType: "radio",
        dataType: "integer",
        displayOrder: order,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      LIKERT_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }
}

async function insertImpairmentElement(
  db: ReturnType<typeof drizzle>,
  definitionId: string,
  elementKey: string,
  displayOrder: number
) {
  const [element] = await db
    .insert(assessmentElements)
    .values({
      assessmentDefinitionId: definitionId,
      elementKey,
      questionText: IMPAIRMENT_QUESTION_TEXT,
      elementType: "radio",
      dataType: "text",
      displayOrder,
      isRequired: true,
      isActive: true,
    })
    .returning({ assessmentElementId: assessmentElements.assessmentElementId })

  await db.insert(assessmentOptions).values(
    IMPAIRMENT_OPTIONS.map((option) => ({
      assessmentElementId: element.assessmentElementId,
      assessmentDefinitionId: definitionId,
      optionLabel: option.label,
      optionValue: option.value,
      scoreValue: option.score,
      displayOrder: option.order,
    }))
  )
}

async function ensurePhq9Impairment(
  db: ReturnType<typeof drizzle>,
  definitionId: string
) {
  const [existing] = await db
    .select({ assessmentElementId: assessmentElements.assessmentElementId })
    .from(assessmentElements)
    .where(eq(assessmentElements.elementKey, "phq9_impairment"))
    .limit(1)

  if (existing) {
    console.log("PHQ-9 impairment question already present — skipping.")
    return
  }

  await insertImpairmentElement(db, definitionId, "phq9_impairment", 10)
  console.log("PHQ-9 impairment question added.")
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const [existing] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "PHQ9"))
    .limit(1)

  if (existing) {
    console.log("PHQ-9 assessment already seeded — checking impairment question.")
    await ensurePhq9Impairment(db, existing.assessmentDefinitionId)
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "PHQ9",
      assessmentName: "PHQ-9",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  await insertLikertQuestions(
    db,
    definition.assessmentDefinitionId,
    "phq9",
    PHQ9_QUESTIONS
  )
  await insertImpairmentElement(
    db,
    definition.assessmentDefinitionId,
    "phq9_impairment",
    10
  )

  console.log("PHQ-9 assessment seeded successfully (9 items + impairment).")
  await pool.end()
}

main().catch((error) => {
  console.error("PHQ-9 seed failed:", error)
  process.exit(1)
})
