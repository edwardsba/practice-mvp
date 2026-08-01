import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { batteryInstanceModules } from "@/db/schema/17-diagnostic-battery"
import { batteryTriggerRules } from "@/db/schema/17-diagnostic-battery"
import { appendTriggeredModule } from "@/lib/assessments/append-triggered-module"

export type EvaluateTriggersParams = {
  assessmentInstanceId: string
  assessmentCode: string
  score: number | null
  structuredScore: Record<string, unknown> | null
  clientId: string
  practiceId: string
  practitionerProfileId: string
}

export type TriggerFireResult = {
  ruleCode: string
  targetAssessmentCode: string
  assessmentInstanceId: string
  assessmentAccessLinkId: string
}

// Called after a result is scored and written. If the submitted assessment isn't part of a
// diagnostic battery chain (e.g. sent as a standalone single-use assessment), this is a no-op —
// trigger rules only apply within an active diagnostic_battery_instances chain.
export async function evaluateAndAppendTriggers(
  params: EvaluateTriggersParams
): Promise<TriggerFireResult[]> {
  const [module] = await db
    .select({
      battleryInstanceModuleId: batteryInstanceModules.batteryInstanceModuleId,
      diagnosticBatteryInstanceId: batteryInstanceModules.diagnosticBatteryInstanceId,
      assessmentAccessLinkId: batteryInstanceModules.assessmentAccessLinkId,
    })
    .from(batteryInstanceModules)
    .where(eq(batteryInstanceModules.assessmentInstanceId, params.assessmentInstanceId))
    .limit(1)

  if (!module) {
    return []
  }

  const rules = await db
    .select()
    .from(batteryTriggerRules)
    .where(
      and(
        eq(batteryTriggerRules.sourceAssessmentCode, params.assessmentCode),
        eq(batteryTriggerRules.isActive, true)
      )
    )

  const fired: TriggerFireResult[] = []

  for (const rule of rules) {
    // domainCode doubles as "which field to read from structuredScoreJson" — for Level 1 XC
    // it'll be a real domain code, for ASRS Part A it's e.g. 'hitCount'. Null domainCode means
    // the rule reads the plain `score` column instead.
    const rawValue = rule.domainCode
      ? params.structuredScore?.[rule.domainCode]
      : params.score

    if (typeof rawValue !== "number") continue

    const passes =
      rule.comparisonOperator === "gte"
        ? rawValue >= rule.thresholdValue
        : rule.comparisonOperator === "gt"
          ? rawValue > rule.thresholdValue
          : rule.comparisonOperator === "eq"
            ? rawValue === rule.thresholdValue
            : false

    if (!passes) continue

    const result = await appendTriggeredModule({
      diagnosticBatteryInstanceId: module.diagnosticBatteryInstanceId,
      previousAccessLinkId: module.assessmentAccessLinkId,
      triggeredByModuleId: module.battleryInstanceModuleId,
      targetAssessmentCode: rule.targetAssessmentCode,
      tier: rule.targetTier as "tier_1" | "tier_2" | "tier_3",
      clientId: params.clientId,
      practiceId: params.practiceId,
      practitionerProfileId: params.practitionerProfileId,
    })

    if (result.ok) {
      fired.push({
        ruleCode: rule.ruleCode,
        targetAssessmentCode: rule.targetAssessmentCode,
        assessmentInstanceId: result.assessmentInstanceId,
        assessmentAccessLinkId: result.assessmentAccessLinkId,
      })
    }
  }

  return fired
}
