import { loadSendableAssessmentByUpperCode } from "@/lib/assessments/load-sendable-assessments"
import {
  orderSendableAssessments,
  type SendableAssessment,
} from "@/lib/assessments/sendable-assessments"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"

function parseSmartGoalItems(value: unknown): string[] {
  if (!value || typeof value !== "object") return []
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items.map((item) => String(item).trim()).filter(Boolean)
}

export type ResolveBatteryChainResult =
  | { ok: true; codes: string[]; smartGoals: string[] }
  | { ok: false; error: string }

/**
 * Validate requested codes against sendable DB definitions, canonicalise to
 * the database's exact assessment_code, order for the chain, and drop BTP when
 * there are no SMART goals.
 */
export async function resolveBatteryChainCodes(
  clientId: string,
  practiceId: string,
  requestedCodes: string[]
): Promise<ResolveBatteryChainResult> {
  const sendableByUpper = await loadSendableAssessmentByUpperCode()
  const treatmentPlan = await loadActiveTreatmentPlanSummary(clientId, practiceId)
  const smartGoals = parseSmartGoalItems(treatmentPlan?.smartGoalsJson)

  const matched: SendableAssessment[] = []
  const seenUpper = new Set<string>()

  for (const raw of requestedCodes) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const upper = trimmed.toUpperCase()
    if (seenUpper.has(upper)) continue

    const sendable = sendableByUpper.get(upper)
    if (!sendable) {
      return {
        ok: false,
        error: `${trimmed} can't be sent to a client.`,
      }
    }

    seenUpper.add(upper)
    matched.push(sendable)
  }

  const ordered = orderSendableAssessments(matched)
  const codes = ordered
    .map((item) => item.assessmentCode)
    .filter((code) => {
      if (code.toUpperCase() !== "BTP") return true
      return smartGoals.length > 0
    })

  return { ok: true, codes, smartGoals }
}
