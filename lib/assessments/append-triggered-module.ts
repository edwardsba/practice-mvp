import { randomBytes } from "crypto"
import { and, eq, max } from "drizzle-orm"

import { assessmentAccessLinks, assessmentDefinitions, assessmentInstances } from "@/db/schema"
import {
  batteryInstanceModules,
  diagnosticBatteryInstances,
} from "@/db/schema/17-diagnostic-battery"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AppendTriggeredModuleParams = {
  diagnosticBatteryInstanceId: string
  previousAccessLinkId: string
  triggeredByModuleId: string
  targetAssessmentCode: string
  tier: "tier_1" | "tier_2" | "tier_3"
  clientId: string
  practiceId: string
  practitionerProfileId: string
  // Pre-fill values for the new instance, keyed by elementKey — e.g. carrying the Specific
  // Disorder Selector's answer forward as item 1's default on a triggered severity scale.
  // Written to assessmentInstances.carriedResponsesJson, NOT assessment_responses — the real
  // response row only gets created when the client actually submits, same as any other item,
  // so this can never collide with the submit route's own insert logic.
  carryForwardResponses?: Record<string, string>
}

export type AppendTriggeredModuleResult =
  | {
      ok: true
      assessmentInstanceId: string
      assessmentAccessLinkId: string
      moduleOrder: number
    }
  | { ok: false; error: string }

// Reactively adds a new module onto an in-progress diagnostic battery chain — e.g. ASRS Part A
// triggering Part B, or PC-PTSD-5 triggering PCL-5. Unlike createDiagnosticBatteryInstance (which
// builds a fixed chain upfront), this runs at submission time once a trigger rule fires, and
// splices the new instrument onto the end of whatever chain already exists.
export async function appendTriggeredModule(
  params: AppendTriggeredModuleParams
): Promise<AppendTriggeredModuleResult> {
  const [definition] = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
    })
    .from(assessmentDefinitions)
    .where(
      and(
        eq(assessmentDefinitions.assessmentCode, params.targetAssessmentCode),
        eq(assessmentDefinitions.isActive, true)
      )
    )
    .limit(1)

  if (!definition) {
    return {
      ok: false,
      error: `${params.targetAssessmentCode} assessment definition is not available.`,
    }
  }

  const [orderRow] = await db
    .select({ maxOrder: max(batteryInstanceModules.moduleOrder) })
    .from(batteryInstanceModules)
    .where(
      eq(
        batteryInstanceModules.diagnosticBatteryInstanceId,
        params.diagnosticBatteryInstanceId
      )
    )

  const nextModuleOrder = (orderRow?.maxOrder ?? 0) + 1

  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashAssessmentToken(rawToken)
  const expiresAt = new Date(Date.now() + LINK_TTL_MS)

  let newInstanceId: string
  let newAccessLinkId: string

  try {
    await db.transaction(async (tx) => {
      const [instance] = await tx
        .insert(assessmentInstances)
        .values({
          assessmentDefinitionId: definition.assessmentDefinitionId,
          clientId: params.clientId,
          practiceId: params.practiceId,
          practitionerProfileId: params.practitionerProfileId,
          status: "assigned",
          carriedResponsesJson:
            params.carryForwardResponses && Object.keys(params.carryForwardResponses).length > 0
              ? params.carryForwardResponses
              : null,
        })
        .returning({
          assessmentInstanceId: assessmentInstances.assessmentInstanceId,
        })

      newInstanceId = instance.assessmentInstanceId

      const [link] = await tx
        .insert(assessmentAccessLinks)
        .values({
          assessmentInstanceId: newInstanceId,
          practiceId: params.practiceId,
          clientId: params.clientId,
          tokenHash,
          expiresAt,
          accessStatus: "active",
        })
        .returning({
          assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
        })

      newAccessLinkId = link.assessmentAccessLinkId

      await tx
        .update(assessmentAccessLinks)
        .set({
          nextAccessLinkId: newAccessLinkId,
          nextRawToken: rawToken,
          updatedAt: new Date(),
        })
        .where(
          eq(assessmentAccessLinks.assessmentAccessLinkId, params.previousAccessLinkId)
        )

      await tx.insert(batteryInstanceModules).values({
        diagnosticBatteryInstanceId: params.diagnosticBatteryInstanceId,
        assessmentInstanceId: newInstanceId,
        assessmentAccessLinkId: newAccessLinkId,
        assessmentCode: params.targetAssessmentCode,
        tier: params.tier,
        moduleOrder: nextModuleOrder,
        triggeredByModuleId: params.triggeredByModuleId,
      })

      await tx
        .update(diagnosticBatteryInstances)
        .set({
          lastLinkId: newAccessLinkId,
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(
          eq(
            diagnosticBatteryInstances.diagnosticBatteryInstanceId,
            params.diagnosticBatteryInstanceId
          )
        )
    })
  } catch {
    return {
      ok: false,
      error: `Unable to append ${params.targetAssessmentCode} to the battery chain.`,
    }
  }

  return {
    ok: true,
    assessmentInstanceId: newInstanceId!,
    assessmentAccessLinkId: newAccessLinkId!,
    moduleOrder: nextModuleOrder,
  }
}
