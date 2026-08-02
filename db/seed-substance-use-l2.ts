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

// DSM-5-TR Level 2 — Substance Use — Adult, adapted from NIDA-Modified ASSIST Question 1
// (the 10-substance lifetime list), reworked to a past-2-weeks frequency screen. Timeframe
// is past 2 weeks (not past 7 days like most other Tier 2 measures). Alcohol and tobacco are
// already captured at Level 1 XC, so they're excluded here. Each item is scored 0-4
// independently — no composite sum, no official cutoff; interpretation is per-item.
// This is "Part 1" of the ASSIST pair — "Part 2" (the existing ASSIST assessment, NIDA
// Questions 2-7 collapsed across substances) is triggered from this one's results, not
// rebuilt here.
const SUBSTANCE_USE_L2_QUESTIONS = [
  { key: "a", text: "Painkillers (like Vicodin)" },
  { key: "b", text: "Stimulants (like Ritalin, Adderall)" },
  { key: "c", text: "Sedatives or tranquilizers (like sleeping pills or Valium)" },
  { key: "d", text: "Marijuana" },
  { key: "e", text: "Cocaine or crack" },
  { key: "f", text: "Club drugs (like ecstasy)" },
  { key: "g", text: "Hallucinogens (like LSD)" },
  { key: "h", text: "Heroin" },
  { key: "i", text: "Inhalants or solvents (like glue)" },
  { key: "j", text: "Methamphetamine (like speed)" },
] as const

const SUBSTANCE_USE_L2_RESPONSE_OPTIONS = [
  { label: "Not at all", value: "0", score: 0, order: 1 },
  { label: "One or two days", value: "1", score: 1, order: 2 },
  { label: "Several days", value: "2", score: 2, order: 3 },
  { label: "More than half the days", value: "3", score: 3, order: 4 },
  { label: "Nearly every day", value: "4", score: 4, order: 5 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "SUBSTANCE_USE_L2"))
    .limit(1)

  if (existing) {
    console.log("Substance Use Level 2 assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "SUBSTANCE_USE_L2",
      assessmentName: "DSM-5-TR Level 2 Substance Use - Adult (adapted NIDA-Modified ASSIST Q1)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < SUBSTANCE_USE_L2_QUESTIONS.length; i++) {
    const question = SUBSTANCE_USE_L2_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `substance_use_l2_${question.key}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
        groupLabel: "Substance Use",
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      SUBSTANCE_USE_L2_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("Substance Use Level 2 assessment seeded successfully (10 items, a-j).")
  await pool.end()
}

main().catch((error) => {
  console.error("Substance Use Level 2 seed failed:", error)
  process.exit(1)
})
