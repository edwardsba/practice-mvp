import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { sageSrPersonalityCriteriaReference } from "./schema"

config({ path: ".env.local" })

// One-off data fix, not a fresh seed — sage_sr_personality_criteria_reference is already
// live (seeded from db/seed-sage-sr-personality-criteria-reference.ts). Running the real
// SAGE-SR Personality parser against the actual Test01 PDFs and diffing every reference
// row's itemText against the real parsed item text (115/117 matched exactly) turned up 2
// mismatches — TeleSage's own item bank has real per-item punctuation inconsistencies
// (most items end in a period, this one genuinely doesn't) and uses plain ASCII quotes,
// not curly quotes. Both matter because scoring does an exact string match against this
// column. Fixed in the seed script's source data too, but the seed script only inserts —
// re-running it after this fix would leave these 2 old, wrong rows behind alongside new
// correct ones, so this direct UPDATE runs first.
const FIXES: Array<{
  disorder: string
  criterionNumber: number
  oldItemText: string
  newItemText: string
}> = [
  {
    disorder: "Paranoid Personality Disorder",
    criterionNumber: 2,
    oldItemText: "I spent a lot of time thinking about whether I could trust my friends or colleagues.",
    newItemText: "I spent a lot of time thinking about whether I could trust my friends or colleagues",
  },
  {
    disorder: "Narcissistic Personality Disorder",
    criterionNumber: 9,
    oldItemText: "People might have thought I was arrogant or \u201csnobby\u201d.",
    newItemText: "People might have thought I was arrogant or \"snobby\".",
  },
]

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  let updatedCount = 0
  for (const fix of FIXES) {
    const result = await db
      .update(sageSrPersonalityCriteriaReference)
      .set({ itemText: fix.newItemText })
      .where(
        and(
          eq(sageSrPersonalityCriteriaReference.disorder, fix.disorder),
          eq(sageSrPersonalityCriteriaReference.criterionNumber, fix.criterionNumber),
          eq(sageSrPersonalityCriteriaReference.itemText, fix.oldItemText)
        )
      )
      .returning({ id: sageSrPersonalityCriteriaReference.sageSrPersonalityCriteriaReferenceId })

    if (result.length === 0) {
      console.warn(`No row found for ${fix.disorder} criterion ${fix.criterionNumber} with old text "${fix.oldItemText}" — already fixed, or never seeded with the bad text. Skipped.`)
    } else {
      updatedCount++
    }
  }

  console.log(`SAGE-SR personality criteria reference item-text fix applied (${updatedCount}/${FIXES.length} rows updated).`)
  await pool.end()
}

main().catch((error) => {
  console.error("Fix failed:", error)
  process.exit(1)
})
