import { config } from "dotenv"
import { eq, and } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { assessmentDefinitions, assessmentElements } from "./schema"

config({ path: ".env.local" })

// One-off data fix, not a fresh seed — PC-PTSD-5 is already live. The gate question is a
// lifetime question ("Have you ever experienced...") and stands alone with no lead-in needed.
// The 5 symptom items are past-month, but the app has no per-item instruction mechanism (only
// one shared banner for the whole page), and that banner can't correctly describe both
// timeframes at once. Fix: bake "In the past month, have you..." directly into each symptom
// item's own wording (this is what the reference doc's stem was always meant to attach to —
// it just never made it into the seeded text), and the shared banner drops to something
// neutral and timeframe-free for this instrument (see questionnaireInstructionForCode).
const UPDATED_ITEMS: Record<string, string> = {
  pcptsd5_q1:
    "In the past month, have you had nightmares about the event(s) or thought about the event(s) when you did not want to?",
  pcptsd5_q2:
    "In the past month, have you tried hard not to think about the event(s) or went out of your way to avoid situations that reminded you of the event(s)?",
  pcptsd5_q3: "In the past month, have you been constantly on guard, watchful, or easily startled?",
  pcptsd5_q4: "In the past month, have you felt numb or detached from people, activities, or your surroundings?",
  pcptsd5_q5:
    "In the past month, have you felt guilty or unable to stop blaming yourself or others for the event(s) or any problems the event(s) may have caused?",
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const [definition] = await db
    .select({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "PC_PTSD5"))
    .limit(1)

  if (!definition) {
    throw new Error("PC_PTSD5 assessment definition not found — nothing to fix.")
  }

  let updatedCount = 0
  for (const [elementKey, questionText] of Object.entries(UPDATED_ITEMS)) {
    const result = await db
      .update(assessmentElements)
      .set({ questionText })
      .where(
        and(
          eq(assessmentElements.assessmentDefinitionId, definition.assessmentDefinitionId),
          eq(assessmentElements.elementKey, elementKey)
        )
      )
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    if (result.length === 0) {
      console.warn(`No element found for ${elementKey} — skipped.`)
    } else {
      updatedCount++
    }
  }

  console.log(`PC-PTSD-5 item wording fix applied (${updatedCount}/5 items updated).`)
  await pool.end()
}

main().catch((error) => {
  console.error("PC-PTSD-5 wording fix failed:", error)
  process.exit(1)
})
