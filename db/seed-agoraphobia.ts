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

// DSM-5-TR Severity Measure for Agoraphobia—Adult. Tier 3 severity-tracking scale, triggered from the Specific Disorder Selector
// (itself triggered directly by Level 1 XC's anxiety domain flag, as a sibling of DASS-21 —
// not gated behind DASS-21's own threshold). Not a standalone screener — no official numeric
// cutoff, interpreted via none/mild/moderate/severe/extreme bands on the average score (see
// anxietySubtypeSeverityFromScore in lib/assessments/severity.ts).
//
// Item 1 here duplicates the selector's own question for this subtype — the carry-forward
// mechanism to skip re-asking it is a later pass (Pass 3), not yet built. For now this item
// gets asked fresh even though the client already answered something very similar.
const AGORAPHOBIA_QUESTIONS = [
  "felt moments of sudden terror, fear, or fright in these situations", // Q1
  "felt anxious, worried, or nervous about these situations", // Q2
  "had thoughts about panic attacks, uncomfortable physical sensations, getting lost, or being overcome with fear in these situations", // Q3
  "felt a racing heart, sweaty, trouble breathing, faint, or shaky in these situations", // Q4
  "felt tense muscles, felt on edge or restless, or had trouble relaxing in these situations", // Q5
  "avoided, or did not approach or enter, these situations", // Q6
  "moved away from these situations, left them early, or remained close to the exits", // Q7
  "spent a lot of time preparing for, or procrastinating about (putting off), these situations", // Q8
  "distracted myself to avoid thinking about these situations", // Q9
  "needed help to cope with these situations (e.g., alcohol or medication, superstitious objects, other people)", // Q10
] as const

const AGORAPHOBIA_RESPONSE_OPTIONS = [
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
    .where(eq(assessmentDefinitions.assessmentCode, "AGORAPHOBIA"))
    .limit(1)

  if (existing) {
    console.log("AGORAPHOBIA assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "AGORAPHOBIA",
      assessmentName: "DSM-5-TR Severity Measure for Agoraphobia—Adult",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < AGORAPHOBIA_QUESTIONS.length; i++) {
    const questionText = AGORAPHOBIA_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `agoraphobia_q${i + 1}`,
        questionText,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      AGORAPHOBIA_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("AGORAPHOBIA assessment seeded successfully (10 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("AGORAPHOBIA seed failed:", error)
  process.exit(1)
})
