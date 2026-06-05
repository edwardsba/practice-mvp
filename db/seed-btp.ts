import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { assessmentDefinitions } from "./schema"

config({ path: ".env.local" })

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
    .where(eq(assessmentDefinitions.assessmentCode, "BTP"))
    .limit(1)

  if (existing) {
    console.log("BTP assessment already seeded — skipping.")
    await pool.end()
    return
  }

  await db.insert(assessmentDefinitions).values({
    assessmentCode: "BTP",
    assessmentName: "Behavioural Targets Progress",
    assessmentType: "psychometric_assessment",
    scoringEnabled: false,
    clientCompletable: true,
    practitionerCompletable: false,
    isActive: true,
  })

  console.log("BTP assessment definition seeded successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("BTP seed failed:", error)
  process.exit(1)
})
