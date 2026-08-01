import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { batteryTriggerRules } from "./schema/17-diagnostic-battery"

config({ path: ".env.local" })

const RULES = [
  {
    ruleCode: "asrs_part_a_to_part_b",
    sourceAssessmentCode: "ASRS_PART_A",
    domainCode: "hitCount", // matches the structuredScoreJson field from calculateAsrsPartAScore
    comparisonOperator: "gte",
    thresholdValue: 4,
    targetAssessmentCode: "ASRS_PART_B",
    targetTier: "tier_1",
  },
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  for (const rule of RULES) {
    const [existing] = await db
      .select({ batteryTriggerRuleId: batteryTriggerRules.batteryTriggerRuleId })
      .from(batteryTriggerRules)
      .where(eq(batteryTriggerRules.ruleCode, rule.ruleCode))
      .limit(1)

    if (existing) {
      console.log(`Rule ${rule.ruleCode} already seeded — skipping.`)
      continue
    }

    await db.insert(batteryTriggerRules).values({
      ruleCode: rule.ruleCode,
      sourceAssessmentCode: rule.sourceAssessmentCode,
      domainCode: rule.domainCode,
      comparisonOperator: rule.comparisonOperator,
      thresholdValue: rule.thresholdValue,
      targetAssessmentCode: rule.targetAssessmentCode,
      targetTier: rule.targetTier,
      isActive: true,
    })

    console.log(`Rule ${rule.ruleCode} seeded successfully.`)
  }

  await pool.end()
}

main().catch((error) => {
  console.error("Battery trigger rules seed failed:", error)
  process.exit(1)
})
