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

const GATE_QUESTION_TEXT =
  "Sometimes things happen to people that are unusually or especially frightening, horrible, or traumatic. For example: a serious accident or fire; a physical or sexual assault or abuse; an earthquake or flood; a war; seeing someone be killed or seriously injured; having a loved one die through homicide or suicide. Have you ever experienced this kind of event?"

const PC_PTSD5_ITEMS = [
  "Had nightmares about the event(s) or thought about the event(s) when you did not want to?",
  "Tried hard not to think about the event(s) or went out of your way to avoid situations that reminded you of the event(s)?",
  "Been constantly on guard, watchful, or easily startled?",
  "Felt numb or detached from people, activities, or your surroundings?",
  "Felt guilty or unable to stop blaming yourself or others for the event(s) or any problems the event(s) may have caused?",
] as const

const YES_NO_OPTIONS = [
  { label: "No", value: "0", score: 0, order: 1 },
  { label: "Yes", value: "1", score: 1, order: 2 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "PC_PTSD5"))
    .limit(1)

  if (existing) {
    console.log("PC-PTSD-5 assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "PC_PTSD5",
      assessmentName: "Primary Care PTSD Screen for DSM-5 (PC-PTSD-5)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  // Gate question — displayOrder 1. If "No", the 5 symptom items are never shown and total = 0.
  // That branching is resolver logic, not seed logic — this script just seeds all 6 elements.
  const [gateElement] = await db
    .insert(assessmentElements)
    .values({
      assessmentDefinitionId: definition.assessmentDefinitionId,
      elementKey: "pcptsd5_gate",
      questionText: GATE_QUESTION_TEXT,
      elementType: "radio",
      dataType: "integer",
      displayOrder: 1,
      isRequired: true,
      isActive: true,
    })
    .returning({ assessmentElementId: assessmentElements.assessmentElementId })

  await db.insert(assessmentOptions).values(
    YES_NO_OPTIONS.map((option) => ({
      assessmentElementId: gateElement.assessmentElementId,
      assessmentDefinitionId: definition.assessmentDefinitionId,
      optionLabel: option.label,
      optionValue: option.value,
      scoreValue: option.score,
      displayOrder: option.order,
    }))
  )

  for (let i = 0; i < PC_PTSD5_ITEMS.length; i++) {
    const order = i + 2 // gate question is order 1
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `pcptsd5_q${i + 1}`,
        questionText: PC_PTSD5_ITEMS[i],
        elementType: "radio",
        dataType: "integer",
        displayOrder: order,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      YES_NO_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("PC-PTSD-5 assessment seeded successfully (1 gate + 5 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("PC-PTSD-5 seed failed:", error)
  process.exit(1)
})
