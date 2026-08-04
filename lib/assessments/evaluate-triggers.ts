import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { assessmentAccessLinks } from "@/db/schema/03-assessment-instances"
import { batteryInstanceModules } from "@/db/schema/17-diagnostic-battery"
import { batteryTriggerRules } from "@/db/schema/17-diagnostic-battery"
import { appendTriggeredModule } from "@/lib/assessments/append-triggered-module"

// Explicit, scoped carry-forward map — NOT general-purpose infrastructure. Currently only the
// Specific Disorder Selector's 4 straightforward subtypes carry an answer forward, since their
// selector question uses the exact same 0-4 scale as the target's own item 1. Specific Phobia
// is deliberately excluded (its selector question is a cluster picker, structurally different
// from its severity scale's item 1 — see specific-disorder-selector.ts).
const CARRY_FORWARD_MAP: Record<
  string,
  Record<string, { sourceField: string; targetElementKey: string }>
> = {
  SPECIFIC_DISORDER_SELECTOR: {
    PANIC_DISORDER: { sourceField: "panic", targetElementKey: "panic_disorder_q1" },
    AGORAPHOBIA: { sourceField: "agoraphobia", targetElementKey: "agoraphobia_q1" },
    SOCIAL_ANXIETY: { sourceField: "social_anxiety", targetElementKey: "social_anxiety_q1" },
    SEPARATION_ANXIETY: {
      sourceField: "separation_anxiety",
      targetElementKey: "separation_anxiety_q1",
    },
  },
}

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

  // Capture whatever this module's link already pointed to (e.g. Level 1 XC's baseline
  // continuation to PC-PTSD-5) so it can be re-attached after any reactively-triggered
  // modules, instead of being silently overwritten by them.
  const [currentLink] = await db
    .select({
      nextAccessLinkId: assessmentAccessLinks.nextAccessLinkId,
      nextRawToken: assessmentAccessLinks.nextRawToken,
    })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.assessmentAccessLinkId, module.assessmentAccessLinkId))
    .limit(1)

  const originalNextAccessLinkId = currentLink?.nextAccessLinkId ?? null
  const originalNextRawToken = currentLink?.nextRawToken ?? null

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
  let tailAccessLinkId = module.assessmentAccessLinkId

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

    // Avoid queuing the same target assessment twice within one battery chain — e.g. if both
    // Depression and Anxiety domains flag simultaneously, both rules target DASS21, but it
    // should only be appended once.
    const [alreadyQueued] = await db
      .select({ batteryInstanceModuleId: batteryInstanceModules.batteryInstanceModuleId })
      .from(batteryInstanceModules)
      .where(
        and(
          eq(
            batteryInstanceModules.diagnosticBatteryInstanceId,
            module.diagnosticBatteryInstanceId
          ),
          eq(batteryInstanceModules.assessmentCode, rule.targetAssessmentCode)
        )
      )
      .limit(1)

    if (alreadyQueued) continue

    const carryForwardRule =
      CARRY_FORWARD_MAP[params.assessmentCode]?.[rule.targetAssessmentCode]
    const carryForwardResponses: Record<string, string> | undefined = carryForwardRule
      ? (() => {
          const value = params.structuredScore?.[carryForwardRule.sourceField]
          return typeof value === "number"
            ? { [carryForwardRule.targetElementKey]: String(value) }
            : undefined
        })()
      : undefined

    const result = await appendTriggeredModule({
      diagnosticBatteryInstanceId: module.diagnosticBatteryInstanceId,
      previousAccessLinkId: tailAccessLinkId,
      triggeredByModuleId: module.battleryInstanceModuleId,
      targetAssessmentCode: rule.targetAssessmentCode,
      tier: rule.targetTier as "tier_1" | "tier_2" | "tier_3",
      clientId: params.clientId,
      practiceId: params.practiceId,
      practitionerProfileId: params.practitionerProfileId,
      carryForwardResponses,
    })

    if (result.ok) {
      fired.push({
        ruleCode: rule.ruleCode,
        targetAssessmentCode: rule.targetAssessmentCode,
        assessmentInstanceId: result.assessmentInstanceId,
        assessmentAccessLinkId: result.assessmentAccessLinkId,
      })
      tailAccessLinkId = result.assessmentAccessLinkId
    }
  }

  // If any triggers fired, the tail has moved past the source module's own link — re-attach
  // whatever this submission's link originally pointed to (e.g. PC-PTSD-5) onto the end of
  // the newly appended chain, so the reactive detour rejoins the original path afterward.
  if (
    tailAccessLinkId !== module.assessmentAccessLinkId &&
    originalNextAccessLinkId &&
    originalNextRawToken
  ) {
    await db
      .update(assessmentAccessLinks)
      .set({
        nextAccessLinkId: originalNextAccessLinkId,
        nextRawToken: originalNextRawToken,
        updatedAt: new Date(),
      })
      .where(eq(assessmentAccessLinks.assessmentAccessLinkId, tailAccessLinkId))
  }

  return fired
}
