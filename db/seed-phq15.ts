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

// Item 4 (menstrual cramps) is nominally "women only" per the reference instrument, but is
// seeded as required like the rest. The submit route's completeness check requires every
// active element to be present regardless of isRequired, so a genuinely optional item would
// currently be un-submittable if skipped — a shared validation gap, not specific to PHQ-15.
// Flagged as a follow-up rather than fixed here. Male clients answer "Not bothered at all".
const PHQ15_QUESTIONS = [
  { text: "Stomach pain" },
  { text: "Back pain" },
  { text: "Pain in your arms, legs, or joints (knees, hips, etc.)" },
  { text: "Menstrual cramps or other problems with your periods (women only)" },
  { text: "Headaches" },
  { text: "Chest pain" },
  { text: "Dizziness" },
  { text: "Fainting spells" },
  { text: "Feeling your heart pound or race" },
  { text: "Shortness of breath" },
  { text: "Pain or problems during sexual intercourse" },
  { text: "Constipation, loose bowels, or diarrhea" },
  { text: "Nausea, gas, or indigestion" },
  { text: "Feeling tired or having low energy" },
  { text: "Trouble sleeping" },
] as const

const PHQ15_RESPONSE_OPTIONS = [
  { label: "Not bothered at all", value: "0", score: 0, order: 1 },
  { label: "Bothered a little", value: "1", score: 1, order: 2 },
  { label: "Bothered a lot", value: "2", score: 2, order: 3 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "PHQ15"))
    .limit(1)

  if (existing) {
    console.log("PHQ-15 assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "PHQ15",
      assessmentName: "DSM-5-TR Level 2 Somatic Symptom - Adult (PHQ-15, adapted)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < PHQ15_QUESTIONS.length; i++) {
    const question = PHQ15_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `phq15_q${i + 1}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
        groupLabel: "Somatic Symptoms",
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      PHQ15_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("PHQ-15 assessment seeded successfully (15 items, all required).")
  await pool.end()
}

main().catch((error) => {
  console.error("PHQ-15 seed failed:", error)
  process.exit(1)
})
