import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { assessmentDefinitions } from "./schema"

config({ path: ".env.local" })

// SAGE-SR is never completed inside Practice MVP — it's completed on TeleSage's own
// platform and arrives afterward as a finished PDF. These three definitions exist so
// SAGE-SR results appear alongside every other assessment in client-facing lists and
// reports, WITHOUT implying they can be assigned/completed through the normal in-app
// questionnaire flow (clientCompletable/practitionerCompletable both false).
// assessmentType: 'external_import' distinguishes these from 'psychometric_assessment' —
// downstream code (assignment UI, the questionnaire engine) should gate on this to avoid
// offering SAGE-SR as something to "send" the way PHQ-9 or the battery gets sent.
const SAGE_SR_DEFINITIONS = [
  {
    assessmentCode: "SAGE_SR_CORE",
    assessmentName: "SAGE-SR Core",
    clientDisplayName: "SAGE-SR Core",
    description: "TeleSage SAGE-SR Core — self-report screener built from SCID-5-CV item pools covering mood, anxiety, OCD, PTSD, psychotic-spectrum, ADHD, and substance use disorders. Completed externally on TeleSage's platform; imported into Practice MVP from the Core Clinician Report + Core Response Report PDF pair.",
  },
  {
    assessmentCode: "SAGE_SR_BACKGROUND",
    assessmentName: "SAGE-SR Background",
    clientDisplayName: "SAGE-SR Background",
    description: "TeleSage SAGE-SR Background — demographics, ACEs, current SDOH, social supports, resiliency, and self-injury/suicide-risk screening items. Completed externally on TeleSage's platform; imported into Practice MVP from the Background Report + Background Response Report PDF pair.",
  },
  {
    assessmentCode: "SAGE_SR_PERSONALITY",
    assessmentName: "SAGE-SR Personality",
    clientDisplayName: "SAGE-SR Personality",
    description: "TeleSage SAGE-SR Personality — categorical screener for all 10 DSM-5-TR personality disorders, with severity tiers and before-age-21 onset flags per item. Completed externally on TeleSage's platform; imported into Practice MVP from the Personality Report + Personality Response Report PDF pair.",
  },
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  let inserted = 0
  let skipped = 0

  for (const def of SAGE_SR_DEFINITIONS) {
    const [existing] = await db
      .select({ id: assessmentDefinitions.assessmentDefinitionId })
      .from(assessmentDefinitions)
      .where(eq(assessmentDefinitions.assessmentCode, def.assessmentCode))
      .limit(1)

    if (existing) {
      skipped++
      continue
    }

    await db.insert(assessmentDefinitions).values({
      assessmentCode: def.assessmentCode,
      assessmentName: def.assessmentName,
      clientDisplayName: def.clientDisplayName,
      assessmentType: "external_import",
      description: def.description,
      scoringEnabled: false, // no in-app score computation — imported results are pre-scored by TeleSage
      clientCompletable: false,
      practitionerCompletable: false,
    })
    inserted++
  }

  console.log(`SAGE-SR assessment definitions seeded: ${inserted} inserted, ${skipped} already present.`)
  await pool.end()
}

main().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
