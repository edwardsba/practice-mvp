import { config } from "dotenv"
import { eq, inArray } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
} from "./schema"
import {
  ASQ_HISTORICAL_ELEMENT_KEY,
  ASQ_RECENT_ELEMENT_KEYS,
  ASQ_Q5_ELEMENT_KEY,
  asqScreenOutcome,
} from "../lib/assessments/asq"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const [asqDefinition] = await db
    .select({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "ASQ"))
    .limit(1)

  if (!asqDefinition) {
    console.log("No ASQ definition found — nothing to backfill.")
    await pool.end()
    return
  }

  const results = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      currentSeverity: assessmentResults.severity,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(assessmentResults.assessmentInstanceId, assessmentInstances.assessmentInstanceId)
    )
    .where(eq(assessmentInstances.assessmentDefinitionId, asqDefinition.assessmentDefinitionId))

  if (results.length === 0) {
    console.log("No ASQ results found — nothing to backfill.")
    await pool.end()
    return
  }

  const instanceIds = results.map((r) => r.assessmentInstanceId)

  const responseRows = await db
    .select({
      assessmentInstanceId: assessmentResponses.assessmentInstanceId,
      elementKey: assessmentElements.elementKey,
      responseValue: assessmentResponses.responseValue,
    })
    .from(assessmentResponses)
    .innerJoin(
      assessmentElements,
      eq(assessmentResponses.assessmentElementId, assessmentElements.assessmentElementId)
    )
    .where(
      inArray(assessmentResponses.assessmentInstanceId, instanceIds)
    )

  const flagsByInstance = new Map<
    string,
    { historicalPositive: boolean; recentPositive: boolean; currentPositive: boolean }
  >()
  for (const instanceId of instanceIds) {
    flagsByInstance.set(instanceId, {
      historicalPositive: false,
      recentPositive: false,
      currentPositive: false,
    })
  }

  for (const row of responseRows) {
    const entry = flagsByInstance.get(row.assessmentInstanceId)
    if (!entry) continue
    if (row.elementKey === ASQ_HISTORICAL_ELEMENT_KEY && row.responseValue === "yes") {
      entry.historicalPositive = true
    }
    if (ASQ_RECENT_ELEMENT_KEYS.includes(row.elementKey) && row.responseValue === "yes") {
      entry.recentPositive = true
    }
    if (row.elementKey === ASQ_Q5_ELEMENT_KEY && row.responseValue === "yes") {
      entry.currentPositive = true
    }
  }

  let updated = 0
  let unchanged = 0

  for (const result of results) {
    const flags = flagsByInstance.get(result.assessmentInstanceId)
    if (!flags) continue

    const newSeverity = asqScreenOutcome(flags)
    if (newSeverity === result.currentSeverity) {
      unchanged++
      continue
    }

    await db
      .update(assessmentResults)
      .set({ severity: newSeverity })
      .where(eq(assessmentResults.assessmentResultId, result.assessmentResultId))

    console.log(
      `Updated ${result.assessmentResultId}: "${result.currentSeverity}" -> "${newSeverity}"`
    )
    updated++
  }

  console.log(`\nDone. ${updated} updated, ${unchanged} already correct.`)
  await pool.end()
}

main().catch((error) => {
  console.error("ASQ severity backfill failed:", error)
  process.exit(1)
})
