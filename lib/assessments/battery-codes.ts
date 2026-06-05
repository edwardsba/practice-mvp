export const BATTERY_ASSESSMENT_CODES = ["PHQ9", "GAD7", "ASSIST"] as const

export type BatteryAssessmentCode = (typeof BATTERY_ASSESSMENT_CODES)[number]

export const BATTERY_ASSESSMENT_LABELS: Record<BatteryAssessmentCode, string> = {
  PHQ9: "PHQ-9",
  GAD7: "GAD-7",
  ASSIST: "ASSIST",
}

export const DEFAULT_BATTERY_CODES: BatteryAssessmentCode[] = ["PHQ9", "GAD7"]

export function isBatteryAssessmentCode(
  code: string
): code is BatteryAssessmentCode {
  return BATTERY_ASSESSMENT_CODES.includes(code as BatteryAssessmentCode)
}

export function normalizeBatteryCodes(codes: string[]): BatteryAssessmentCode[] {
  const seen = new Set<BatteryAssessmentCode>()
  const normalized: BatteryAssessmentCode[] = []

  for (const code of codes) {
    const upper = code.trim().toUpperCase()
    if (!isBatteryAssessmentCode(upper) || seen.has(upper)) continue
    seen.add(upper)
    normalized.push(upper)
  }

  return normalized
}
