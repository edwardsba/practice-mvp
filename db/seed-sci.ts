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

// IMPORTANT: SCI is scored in the OPPOSITE direction from every other instrument in this
// battery — higher score = better sleep, lower score = worse. Each item is scored 4 (best,
// leftmost option) down to 0 (worst, rightmost option). Per-item response options genuinely
// differ (unlike DASS-21/PHQ-15/DES-B, which share one option set) — the per-item lead-in
// stems are folded into each questionText below since they don't reduce to a single generic
// instruction line (per the reference doc's own note).
const SCI_QUESTIONS = [
  {
    text: "Thinking about a typical night in the last month, how long does it take you to fall asleep?",
    options: [
      { label: "0-15 min", score: 4 },
      { label: "16-30 min", score: 3 },
      { label: "31-45 min", score: 2 },
      { label: "46-60 min", score: 1 },
      { label: "61 min or more", score: 0 },
    ],
  },
  {
    text: "Thinking about a typical night in the last month, if you then wake up during the night, how long are you awake for in total? (Add up all the wakenings.)",
    options: [
      { label: "0-15 min", score: 4 },
      { label: "16-30 min", score: 3 },
      { label: "31-45 min", score: 2 },
      { label: "46-60 min", score: 1 },
      { label: "61 min or more", score: 0 },
    ],
  },
  {
    text: "Thinking about a typical night in the last month, how many nights a week do you have a problem with your sleep?",
    options: [
      { label: "0-1", score: 4 },
      { label: "2", score: 3 },
      { label: "3", score: 2 },
      { label: "4", score: 1 },
      { label: "5-7", score: 0 },
    ],
  },
  {
    text: "Thinking about a typical night in the last month, how would you rate your sleep quality?",
    options: [
      { label: "Very good", score: 4 },
      { label: "Good", score: 3 },
      { label: "Average", score: 2 },
      { label: "Poor", score: 1 },
      { label: "Very poor", score: 0 },
    ],
  },
  {
    text: "Thinking about the past month, to what extent has poor sleep affected your mood, energy, or relationships?",
    options: [
      { label: "Not at all", score: 4 },
      { label: "A little", score: 3 },
      { label: "Somewhat", score: 2 },
      { label: "Much", score: 1 },
      { label: "Very much", score: 0 },
    ],
  },
  {
    text: "Thinking about the past month, to what extent has poor sleep affected your concentration, productivity, or ability to stay awake?",
    options: [
      { label: "Not at all", score: 4 },
      { label: "A little", score: 3 },
      { label: "Somewhat", score: 2 },
      { label: "Much", score: 1 },
      { label: "Very much", score: 0 },
    ],
  },
  {
    text: "Thinking about the past month, to what extent has poor sleep troubled you in general?",
    options: [
      { label: "Not at all", score: 4 },
      { label: "A little", score: 3 },
      { label: "Somewhat", score: 2 },
      { label: "Much", score: 1 },
      { label: "Very much", score: 0 },
    ],
  },
  {
    text: "How long have you had a problem with your sleep?",
    options: [
      { label: "I don't have a problem / less than 1 month", score: 4 },
      { label: "1-2 months", score: 3 },
      { label: "3-6 months", score: 2 },
      { label: "7-12 months", score: 1 },
      { label: "More than 1 year", score: 0 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "SCI"))
    .limit(1)

  if (existing) {
    console.log("SCI assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "SCI",
      assessmentName: "Sleep Condition Indicator (SCI)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < SCI_QUESTIONS.length; i++) {
    const question = SCI_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `sci_q${i + 1}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
        groupLabel: "Sleep",
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      question.options.map((option, optionIndex) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: String(option.score),
        scoreValue: option.score,
        displayOrder: optionIndex + 1,
      }))
    )
  }

  console.log("SCI assessment seeded successfully (8 items, per-item response options).")
  await pool.end()
}

main().catch((error) => {
  console.error("SCI seed failed:", error)
  process.exit(1)
})
