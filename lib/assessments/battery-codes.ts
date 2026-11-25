/**
 * Default pre-session battery set (BTP / PHQ-9 / GAD-7 / ASSIST).
 * Not the list of every assessment that can be sent to a client — that comes
 * from the database via load-sendable-assessments / sendable-assessments.
 */

import {
  DEFAULT_PRE_SESSION_BATTERY_CODES,
  PRE_SESSION_BATTERY_CODES,
  PRE_SESSION_BATTERY_LABELS,
  PRE_SESSION_BATTERY_SEQUENCE,
  isPreSessionBatteryCode,
  type PreSessionBatteryCode,
} from "@/lib/assessments/sendable-assessments"

/** @deprecated Prefer PRE_SESSION_BATTERY_CODES — kept as the historical name. */
export const BATTERY_ASSESSMENT_CODES = PRE_SESSION_BATTERY_CODES

export type BatteryAssessmentCode = PreSessionBatteryCode

export const BATTERY_ASSESSMENT_LABELS = PRE_SESSION_BATTERY_LABELS

export const BATTERY_SEQUENCE_ORDER = PRE_SESSION_BATTERY_SEQUENCE

export const DEFAULT_BATTERY_CODES = DEFAULT_PRE_SESSION_BATTERY_CODES

export function isBatteryAssessmentCode(
  code: string
): code is BatteryAssessmentCode {
  return isPreSessionBatteryCode(code)
}

/** Keep only known pre-session battery codes (uppercased, deduped). */
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

export function orderBatteryCodes(
  codes: BatteryAssessmentCode[]
): BatteryAssessmentCode[] {
  return BATTERY_SEQUENCE_ORDER.filter((code) => codes.includes(code))
}
