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

// DSM-5-TR Severity Measure for Panic Disorder—Adult. Tier 3 severity-tracking scale, triggered from the Specific Disorder Selector
// (itself triggered directly by Level 1 XC's anxiety domain flag, as a sibling of DASS-21 —
// not gated behind DASS-21's own threshold). Not a standalone screener — no official numeric
// cutoff, interpreted via none/mild/moderate/severe/extreme bands on the average score (see
// anxietySubtypeSeverityFromScore in lib/assessments/severity.ts).
//
// Item 1 here duplicates the selector's own question for this subtype — the carry-forward
// mechanism to skip re-asking it is a later pass (Pass 3), not yet built. For now this item
// gets asked fresh even though the client already answered something very similar.
const PANIC_DISORDER_QUESTIONS = [
  "felt moments of sudden terror, fear or fright, sometimes out of the blue (i.e., a panic attack)", // Q1
  "felt anxious, worried, or nervous about having more panic attacks", // Q2
  "had thoughts of losing control, dying, going crazy, or other bad things happening because of panic attacks", // Q3
  "felt a racing heart, sweaty, trouble breathing, faint, or shaky", // Q4
  "felt tense muscles, felt on edge or restless, or had trouble relaxing or trouble sleeping", // Q5
  "avoided, or did not approach or enter, situations in which panic attacks might occur", // Q6
  "left situations early, or participated only minimally, because of panic attacks", // Q7
  "spent a lot of time preparing for, or procrastinating about (putting off), situations in which panic attacks might occur", // Q8
  "distracted myself to avoid thinking about panic attacks", // Q9
  "needed help to cope with panic attacks (e.g., alcohol or medication, superstitious objects, other people)", // Q10
] as const

const PANIC_DISORDER_RESPONSE_OPTIONS = [
  { label: "Never", value: "0", score: 0, order: 1 },
  { label: "Occasionally", value: "1", score: 1, order: 2 },
  { label: "Half of the time", value: "2", score: 2, order: 3 },
  { label: "Most of the time", value: "3", score: 3, order: 4 },
  { label: "All of the time", value: "4", score: 4, order: 5 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "PANIC_DISORDER"))
    .limit(1)

  if (existing) {
    console.log("PANIC_DISORDER assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "PANIC_DISORDER",
      assessmentName: "DSM-5-TR Severity Measure for Panic Disorder—Adult",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < PANIC_DISORDER_QUESTIONS.length; i++) {
    const questionText = PANIC_DISORDER_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `panic_disorder_q${i + 1}`,
        questionText,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      PANIC_DISORDER_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("PANIC_DISORDER assessment seeded successfully (10 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("PANIC_DISORDER seed failed:", error)
  process.exit(1)
})
