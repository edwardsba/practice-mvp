import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { assessmentDefinitions } from "./schema"

config({ path: ".env.local" })

// One-off data fix, not a fresh seed — every assessment_definitions row here already exists in
// production. Values sourced from Ben's review pass (Aug 2026), not written from memory. Codes
// not listed here (ASQ, mse) are practitioner-completed only and never shown to a client, so no
// client_display_name is needed — the column stays null and the client-facing page falls back
// to assessmentName for anything not in this map (which should never actually happen for a
// client-completable instrument once this runs).
const CLIENT_DISPLAY_NAME_BY_CODE: Record<string, string> = {
  LEVEL1_XC: "APA DSM5 L1",
  PC_PTSD5: "PC PTSD DSM5",
  ASRS_PART_A: "ADHD ASRS A",
  ASRS_PART_B: "ADHD ASRS B",
  PID5_FBF: "PID-5-FBF",
  DASS21: "DASS-21",
  PHQ15: "APA L2 PHQ15",
  SUBSTANCE_USE_L2: "APA L2 NIDA ASSIST",
  DES_B: "APA L2 DES-B",
  SCI: "APA L2 SCI",
  ASRM: "APA L2 ASRM",
  // "Anxety" corrected to "Anxiety" — typo in the source spreadsheet, fixed here since it's an
  // unambiguous spelling error rather than a naming style choice.
  SPECIFIC_DISORDER_SELECTOR: "APA L2 Anxiety Screen",
  PANIC_DISORDER: "APA L2 Panic",
  AGORAPHOBIA: "APA L2 Agoraphobia",
  SOCIAL_ANXIETY: "APA L2 Social",
  SEPARATION_ANXIETY: "APA L2 Separation",
  SPECIFIC_PHOBIA: "APA L2 Phobia",
  PCL5: "PTSD PCL-5",
  PHQ9: "PHQ9",
  GAD7: "GAD7",
  ASSIST: "ASSIST",
  BTP: "Behavioural Targets",
  PSF: "Post-Session Feedback",
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  let updated = 0
  let skipped = 0

  for (const [assessmentCode, clientDisplayName] of Object.entries(
    CLIENT_DISPLAY_NAME_BY_CODE
  )) {
    const result = await db
      .update(assessmentDefinitions)
      .set({ clientDisplayName, updatedAt: new Date() })
      .where(eq(assessmentDefinitions.assessmentCode, assessmentCode))
      .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

    if (result.length === 0) {
      console.warn(`No assessment_definitions row found for code: ${assessmentCode}`)
      skipped += 1
    } else {
      updated += 1
    }
  }

  console.log(`client_display_name set on ${updated} definitions, ${skipped} codes not found.`)
  await pool.end()
}

main().catch((error) => {
  console.error("Data fix failed:", error)
  process.exit(1)
})
