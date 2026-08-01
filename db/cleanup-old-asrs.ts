import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
  assessmentInstances,
} from "./schema"

config({ path: ".env.local" })

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
    .where(eq(assessmentDefinitions.assessmentCode, "ASRS"))
    .limit(1)

  if (!definition) {
    console.log("No ASRS definition found — nothing to clean up.")
    await pool.end()
    return
  }

  const [instance] = await db
    .select({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })
    .from(assessmentInstances)
    .where(eq(assessmentInstances.assessmentDefinitionId, definition.assessmentDefinitionId))
    .limit(1)

  if (instance) {
    throw new Error(
      "Found at least one assessment_instance referencing the old ASRS definition — refusing to delete. Investigate before proceeding."
    )
  }

  const elements = await db
    .select({ assessmentElementId: assessmentElements.assessmentElementId })
    .from(assessmentElements)
    .where(eq(assessmentElements.assessmentDefinitionId, definition.assessmentDefinitionId))

  for (const element of elements) {
    await db
      .delete(assessmentOptions)
      .where(eq(assessmentOptions.assessmentElementId, element.assessmentElementId))
  }

  await db
    .delete(assessmentElements)
    .where(eq(assessmentElements.assessmentDefinitionId, definition.assessmentDefinitionId))

  await db
    .delete(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentDefinitionId, definition.assessmentDefinitionId))

  console.log("Old ASRS definition, elements, and options deleted successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("ASRS cleanup failed:", error)
  process.exit(1)
})
