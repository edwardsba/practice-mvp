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
  // Level 1 XC domain-flag rules — thresholds and targets are the APA's own official
  // "next-step activation" table (Level 1 XC results scoring table). Depression and Anxiety
  // both target DASS21 — relies on the dedup check in evaluateAndAppendTriggers so a client
  // flagging both domains at once only gets DASS21 queued once.
  {
    ruleCode: "level1xc_depression_to_dass21",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "depression",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "DASS21",
    targetTier: "tier_2",
  },
  {
    ruleCode: "level1xc_anxiety_to_dass21",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "anxiety",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "DASS21",
    targetTier: "tier_2",
  },
  {
    // Sibling of the rule above, not downstream of it — the SAME Level 1 XC anxiety flag
    // fires both DASS21 and this selector directly, off one Level 1 XC submission. The
    // selector is NOT gated behind DASS-21's own Anxiety subscale threshold.
    ruleCode: "level1xc_anxiety_to_specific_disorder_selector",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "anxiety",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "SPECIFIC_DISORDER_SELECTOR",
    targetTier: "tier_2",
  },
  {
    // Threshold of 2 ("Half of the time" or higher) matches the convention used everywhere
    // else in this battery for "moderate" domain flags (Level 1 XC's own depression/anxiety/
    // mania/etc. rules all use >= 2). Specific Phobia's rule is deliberately NOT included yet
    // — its target (the 10-item severity scale) doesn't exist until that pass ships.
    ruleCode: "specific_disorder_selector_panic_to_panic_disorder",
    sourceAssessmentCode: "SPECIFIC_DISORDER_SELECTOR",
    domainCode: "panic",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "PANIC_DISORDER",
    targetTier: "tier_3",
  },
  {
    ruleCode: "specific_disorder_selector_agoraphobia_to_agoraphobia",
    sourceAssessmentCode: "SPECIFIC_DISORDER_SELECTOR",
    domainCode: "agoraphobia",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "AGORAPHOBIA",
    targetTier: "tier_3",
  },
  {
    ruleCode: "specific_disorder_selector_social_anxiety_to_social_anxiety",
    sourceAssessmentCode: "SPECIFIC_DISORDER_SELECTOR",
    domainCode: "social_anxiety",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "SOCIAL_ANXIETY",
    targetTier: "tier_3",
  },
  {
    ruleCode: "specific_disorder_selector_separation_anxiety_to_separation_anxiety",
    sourceAssessmentCode: "SPECIFIC_DISORDER_SELECTOR",
    domainCode: "separation_anxiety",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "SEPARATION_ANXIETY",
    targetTier: "tier_3",
  },
  {
    // Different threshold logic from the other 4 subtype rules — specific_phobia_cluster is
    // 0 ("None of these") or 1-5 (which cluster), not a 0-4 frequency rating, so >= 1 means
    // "any cluster was chosen" rather than "moderate or higher frequency."
    ruleCode: "specific_disorder_selector_specific_phobia_to_specific_phobia",
    sourceAssessmentCode: "SPECIFIC_DISORDER_SELECTOR",
    domainCode: "specific_phobia_cluster",
    comparisonOperator: "gte",
    thresholdValue: 1,
    targetAssessmentCode: "SPECIFIC_PHOBIA",
    targetTier: "tier_3",
  },
  {
    // Optimally sensitive cutoff (minimizes false negatives), per the design's stated
    // preference for sensitivity throughout this battery — matches the same choice already
    // made for PC-PTSD-5's own threshold.
    ruleCode: "pcptsd5_to_pcl5",
    sourceAssessmentCode: "PC_PTSD5",
    domainCode: null,
    comparisonOperator: "gte",
    thresholdValue: 3,
    targetAssessmentCode: "PCL5",
    targetTier: "tier_3",
  },
  {
    ruleCode: "level1xc_mania_to_asrm",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "mania",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "ASRM",
    targetTier: "tier_2",
  },
  {
    ruleCode: "level1xc_somatic_to_phq15",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "somatic",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "PHQ15",
    targetTier: "tier_2",
  },
  {
    ruleCode: "level1xc_sleep_to_sci",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "sleep",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "SCI",
    targetTier: "tier_2",
  },
  {
    ruleCode: "level1xc_dissociation_to_des_b",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "dissociation",
    comparisonOperator: "gte",
    thresholdValue: 2,
    targetAssessmentCode: "DES_B",
    targetTier: "tier_2",
  },
  {
    // Substance Use's threshold is 1 ("Slight"), not 2 like the other domains — matches the
    // official table (same lower threshold as Suicidal Ideation).
    ruleCode: "level1xc_substance_use_to_substance_use_l2",
    sourceAssessmentCode: "LEVEL1_XC",
    domainCode: "substance_use",
    comparisonOperator: "gte",
    thresholdValue: 1,
    targetAssessmentCode: "SUBSTANCE_USE_L2",
    targetTier: "tier_2",
  },
  {
    // "Part 1 -> Part 2" — any substance endorsed in the past 2 weeks triggers the existing
    // ASSIST assessment (NIDA Questions 2-7, involvement scoring). Reuses the ASSIST
    // definition as-is; no rebuild needed.
    ruleCode: "substance_use_l2_to_assist",
    sourceAssessmentCode: "SUBSTANCE_USE_L2",
    domainCode: "endorsedCount", // matches the structuredScoreJson field from calculateSubstanceUseL2Scores
    comparisonOperator: "gte",
    thresholdValue: 1,
    targetAssessmentCode: "ASSIST",
    targetTier: "tier_2",
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
