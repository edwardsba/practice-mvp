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

// Specific Phobia — DSM-5-TR Severity Measure for Specific Phobia—Adult. Tier 3 severity-
// tracking scale, triggered directly by the Specific Disorder Selector's cluster-picker item
// (specific_phobia_cluster >= 1, i.e. any cluster chosen other than "None of these"). No
// separate cluster-picker module needed here — the selector's own item 5 already served
// that role and its choice is stored on the selector's own result (see
// specific-disorder-selector.ts) for clinical reference. No carry-forward for this instrument's
// item 1 — it's structurally different from the selector's cluster-choice question, so it
// gets asked fresh (per explicit design decision, not an oversight).
const SPECIFIC_PHOBIA_QUESTIONS = [
  "felt moments of sudden terror, fear, or fright in these situations", // Q1
  "felt anxious, worried, or nervous about these situations", // Q2
  "had thoughts of being injured, overcome with fear, or other bad things happening in these situations", // Q3
  "felt a racing heart, sweaty, trouble breathing, faint, or shaky in these situations", // Q4
  "felt tense muscles, felt on edge or restless, or had trouble relaxing in these situations", // Q5
  "avoided, or did not approach or enter, these situations", // Q6
  "moved away from these situations or left them early", // Q7
  "spent a lot of time preparing for, or procrastinating about (i.e., putting off), these situations", // Q8
  "distracted myself to avoid thinking about these situations", // Q9
  "needed help to cope with these situations (e.g., alcohol or medications, superstitious objects, other people)", // Q10
] as const

const SPECIFIC_PHOBIA_RESPONSE_OPTIONS = [
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
    .where(eq(assessmentDefinitions.assessmentCode, "SPECIFIC_PHOBIA"))
    .limit(1)

  if (existing) {
    console.log("SPECIFIC_PHOBIA assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "SPECIFIC_PHOBIA",
      assessmentName: "DSM-5-TR Severity Measure for Specific Phobia—Adult",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < SPECIFIC_PHOBIA_QUESTIONS.length; i++) {
    const questionText = SPECIFIC_PHOBIA_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `specific_phobia_q${i + 1}`,
        questionText,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      SPECIFIC_PHOBIA_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("SPECIFIC_PHOBIA assessment seeded successfully (10 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("SPECIFIC_PHOBIA seed failed:", error)
  process.exit(1)
})
