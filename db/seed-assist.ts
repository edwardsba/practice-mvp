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

type AssistOption = {
  label: string
  value: string
  score: number
  order: number
}

type AssistQuestion = {
  key: string
  order: number
  text: string
  options: AssistOption[]
}

const FREQUENCY_OPTIONS_Q1: AssistOption[] = [
  { label: "Never", value: "never", score: 0, order: 1 },
  { label: "Once or twice", value: "once_or_twice", score: 2, order: 2 },
  { label: "Less than half the time", value: "less_than_half", score: 3, order: 3 },
  { label: "More than half the time", value: "more_than_half", score: 4, order: 4 },
  { label: "Daily or almost daily", value: "daily", score: 6, order: 5 },
]

const FREQUENCY_OPTIONS_Q2: AssistOption[] = [
  { label: "Never", value: "never", score: 0, order: 1 },
  { label: "Once or twice", value: "once_or_twice", score: 3, order: 2 },
  { label: "Less than half the time", value: "less_than_half", score: 4, order: 3 },
  { label: "More than half the time", value: "more_than_half", score: 5, order: 4 },
  { label: "Daily or almost daily", value: "daily", score: 6, order: 5 },
]

const FREQUENCY_OPTIONS_Q3: AssistOption[] = [
  { label: "Never", value: "never", score: 0, order: 1 },
  { label: "Once or twice", value: "once_or_twice", score: 4, order: 2 },
  { label: "Less than half the time", value: "less_than_half", score: 5, order: 3 },
  { label: "More than half the time", value: "more_than_half", score: 6, order: 4 },
  { label: "Daily or almost daily", value: "daily", score: 7, order: 5 },
]

const FREQUENCY_OPTIONS_Q4: AssistOption[] = [
  { label: "Never", value: "never", score: 0, order: 1 },
  { label: "Once or twice", value: "once_or_twice", score: 5, order: 2 },
  { label: "Less than half the time", value: "less_than_half", score: 6, order: 3 },
  { label: "More than half the time", value: "more_than_half", score: 7, order: 4 },
  { label: "Daily or almost daily", value: "daily", score: 8, order: 5 },
]

const YES_NO_OPTIONS: AssistOption[] = [
  { label: "No", value: "no", score: 0, order: 1 },
  { label: "Yes", value: "yes", score: 6, order: 2 },
]

const ASSIST_QUESTIONS: AssistQuestion[] = [
  {
    key: "assist_q1",
    order: 1,
    text: "How often have you used alcohol or drugs?",
    options: FREQUENCY_OPTIONS_Q1,
  },
  {
    key: "assist_q2",
    order: 2,
    text: "How often have you had a strong desire or urge to drink or use?",
    options: FREQUENCY_OPTIONS_Q2,
  },
  {
    key: "assist_q3",
    order: 3,
    text: "How often has your drinking or drug use led to health, social, legal or financial problems?",
    options: FREQUENCY_OPTIONS_Q3,
  },
  {
    key: "assist_q4",
    order: 4,
    text: "How often have you failed to do what was normally expected of you because of your drinking or drug use?",
    options: FREQUENCY_OPTIONS_Q4,
  },
  {
    key: "assist_q5",
    order: 5,
    text: "Has anyone else expressed concern about your drinking or drug use?",
    options: YES_NO_OPTIONS,
  },
  {
    key: "assist_q6",
    order: 6,
    text: "Have you tried and failed to control, cut down or stop drinking or using?",
    options: YES_NO_OPTIONS,
  },
]

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
    .where(eq(assessmentDefinitions.assessmentCode, "ASSIST"))
    .limit(1)

  if (existing) {
    console.log("ASSIST assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "ASSIST",
      assessmentName: "ASSIST",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (const question of ASSIST_QUESTIONS) {
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
      question.options.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("ASSIST assessment seeded successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("ASSIST seed failed:", error)
  process.exit(1)
})
