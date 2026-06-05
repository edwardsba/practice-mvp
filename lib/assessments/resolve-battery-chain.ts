import {
  normalizeBatteryCodes,
  orderBatteryCodes,
  type BatteryAssessmentCode,
} from "@/lib/assessments/battery-codes"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"

function parseBehaviouralTargetItems(value: unknown): string[] {
  if (!value || typeof value !== "object") return []
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items.map((item) => String(item).trim()).filter(Boolean)
}

export async function resolveBatteryChainCodes(
  clientId: string,
  practiceId: string,
  requestedCodes: string[]
): Promise<{
  codes: BatteryAssessmentCode[]
  behaviouralTargets: string[]
}> {
  const normalized = orderBatteryCodes(normalizeBatteryCodes(requestedCodes))
  const treatmentPlan = await loadActiveTreatmentPlanSummary(clientId, practiceId)
  const behaviouralTargets = parseBehaviouralTargetItems(
    treatmentPlan?.behaviouralTargetsJson
  )

  const codes = normalized.filter((code) => {
    if (code !== "BTP") return true
    return behaviouralTargets.length > 0
  })

  return { codes, behaviouralTargets }
}
