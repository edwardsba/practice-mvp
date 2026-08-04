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

// Specific Disorder Selector Assessment — Tier 2, triggered alongside DASS-21 by the same
// Level 1 XC anxiety domain flag (not gated behind DASS-21). 5 questions, 4 using the standard
// 0-4 frequency scale plus a single-select cluster picker for Specific Phobia. See
// lib/assessments/specific-disorder-selector.ts for the scoring/field-mapping logic.
const FREQUENCY_QUESTIONS = [
  {
    key: "panic",
    text: "felt moments of sudden terror, fear or fright sometimes out of the blue (i.e. a panic attack).",
  },
  {
    key: "agoraphobia",
    text: "felt moments of sudden terror, fear, or fright in crowds, public spaces, using transportation (e.g. buses planes, trains), travelling alone, or away from home.",
  },
  {
    key: "social_anxiety",
    text: "felt moments of sudden terror, fear, or fright in social situations such as: public speaking, speaking in meetings, attending social events or parties, introducing yourself to others, having conversations, giving and receiving compliments, making requests of others, and eating and writing in public.",
  },
  {
    key: "separation_anxiety",
    text: "felt moments of sudden terror, fear or fright when separated from home, or from people who are important to you.",
  },
] as const

const FREQUENCY_OPTIONS = [
  { label: "Never", value: "0", score: 0, order: 1 },
  { label: "Occasionally", value: "1", score: 1, order: 2 },
  { label: "Half of the time", value: "2", score: 2, order: 3 },
  { label: "Most of the time", value: "3", score: 3, order: 4 },
  { label: "All of the time", value: "4", score: 4, order: 5 },
] as const

const SPECIFIC_PHOBIA_QUESTION_TEXT =
  "felt moments of sudden terror, fear, or fright in these situations (choose the item that makes you the most anxious)."

// Values 1-5 match SPECIFIC_PHOBIA_CLUSTER_LABELS in the scoring function; 0 = opt-out, added
// so a client without a specific phobia isn't forced to pick a cluster. Exact wording of the
// opt-out option is a placeholder — flagged for review.
const SPECIFIC_PHOBIA_OPTIONS = [
  { label: "None of these — this doesn't apply to me", value: "0", score: 0, order: 1 },
  { label: "Driving, flying, tunnels, bridges, or enclosed spaces", value: "1", score: 1, order: 2 },
  { label: "Animals or insects", value: "2", score: 2, order: 3 },
  { label: "Heights, storms, or water", value: "3", score: 3, order: 4 },
  { label: "Blood, needles, or injections", value: "4", score: 4, order: 5 },
  { label: "Choking or vomiting", value: "5", score: 5, order: 6 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "SPECIFIC_DISORDER_SELECTOR"))
    .limit(1)

  if (existing) {
    console.log("SPECIFIC_DISORDER_SELECTOR assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "SPECIFIC_DISORDER_SELECTOR",
      assessmentName: "Specific Disorder Selector Assessment",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  let displayOrder = 1

  for (const question of FREQUENCY_QUESTIONS) {
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `specific_disorder_selector_${question.key}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: displayOrder++,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      FREQUENCY_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  const [specificPhobiaElement] = await db
    .insert(assessmentElements)
    .values({
      assessmentDefinitionId: definition.assessmentDefinitionId,
      elementKey: "specific_disorder_selector_specific_phobia",
      questionText: SPECIFIC_PHOBIA_QUESTION_TEXT,
      elementType: "radio",
      dataType: "integer",
      displayOrder: displayOrder++,
      isRequired: true,
      isActive: true,
    })
    .returning({ assessmentElementId: assessmentElements.assessmentElementId })

  await db.insert(assessmentOptions).values(
    SPECIFIC_PHOBIA_OPTIONS.map((option) => ({
      assessmentElementId: specificPhobiaElement.assessmentElementId,
      assessmentDefinitionId: definition.assessmentDefinitionId,
      optionLabel: option.label,
      optionValue: option.value,
      scoreValue: option.score,
      displayOrder: option.order,
    }))
  )

  console.log("SPECIFIC_DISORDER_SELECTOR assessment seeded successfully (5 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("SPECIFIC_DISORDER_SELECTOR seed failed:", error)
  process.exit(1)
})
