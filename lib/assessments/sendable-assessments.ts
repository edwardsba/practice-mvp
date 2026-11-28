/**
 * Sendable assessments = client-completable instruments the Send list / battery
 * path may offer. Source of truth is the database flags; this module holds only
 * pure ordering, exceptions, and the shared decision helpers.
 */

/** Codes that are client_completable but must not appear on the Send list. */
export const SEND_LIST_EXCEPTIONS: Readonly<Record<string, string>> = {
  // Reserved for future exclusions. BACKGROUND_SR is a normal shared-form assessment.
}

/** Default pre-session battery set (not “all sendable”). */
export const PRE_SESSION_BATTERY_CODES = ["BTP", "PHQ9", "GAD7", "ASSIST"] as const

export type PreSessionBatteryCode = (typeof PRE_SESSION_BATTERY_CODES)[number]

export const PRE_SESSION_BATTERY_LABELS: Record<PreSessionBatteryCode, string> = {
  BTP: "BTP",
  PHQ9: "PHQ-9",
  GAD7: "GAD-7",
  ASSIST: "ASSIST",
}

export const PRE_SESSION_BATTERY_SEQUENCE: PreSessionBatteryCode[] = [
  "BTP",
  "PHQ9",
  "GAD7",
  "ASSIST",
]

export const DEFAULT_PRE_SESSION_BATTERY_CODES: PreSessionBatteryCode[] = [
  "PHQ9",
  "GAD7",
]

export type SendableAssessment = {
  assessmentCode: string
  assessmentName: string
  displayLabel: string
}

export function isSendListException(assessmentCode: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    SEND_LIST_EXCEPTIONS,
    assessmentCode
  )
}

/**
 * Whether a definition belongs on the Send list / battery chain.
 * BTP has no static elements (instance elements are created at send time).
 */
export function qualifiesAsSendable(params: {
  assessmentCode: string
  isActive: boolean
  clientCompletable: boolean
  hasActiveElements: boolean
}): boolean {
  if (!params.isActive) return false
  if (!params.clientCompletable) return false
  if (isSendListException(params.assessmentCode)) return false
  if (params.assessmentCode.toUpperCase() === "BTP") return true
  return params.hasActiveElements
}

/**
 * Single-link createAssessmentLink gate: active + client_completable only.
 */
export function canCreateClientAssessmentLink(
  definition: {
    isActive: boolean
    clientCompletable: boolean
  } | null
): { ok: true } | { ok: false; error: string } {
  if (!definition || !definition.isActive) {
    return { ok: false, error: "Assessment definition not found." }
  }
  if (!definition.clientCompletable) {
    return {
      ok: false,
      error: "This assessment can't be sent to a client.",
    }
  }
  return { ok: true }
}

/**
 * Order: pre-session battery codes first (existing sequence), then A–Z by
 * display label. Unknown codes among the battery set are ignored for the
 * leading block; everything else sorts alphabetically.
 */
export function orderSendableAssessments<
  T extends { assessmentCode: string; displayLabel: string },
>(items: T[]): T[] {
  const byUpper = new Map<string, T>()
  for (const item of items) {
    byUpper.set(item.assessmentCode.toUpperCase(), item)
  }

  const leading: T[] = []
  const used = new Set<string>()
  for (const code of PRE_SESSION_BATTERY_SEQUENCE) {
    const item = byUpper.get(code)
    if (!item) continue
    leading.push(item)
    used.add(item.assessmentCode)
  }

  const rest = items
    .filter((item) => !used.has(item.assessmentCode))
    .slice()
    .sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, "en", {
        sensitivity: "base",
      })
    )

  return [...leading, ...rest]
}

export function displayLabelForAssessment(params: {
  assessmentCode: string
  assessmentName: string
  clientDisplayName?: string | null
}): string {
  const upper = params.assessmentCode.toUpperCase()
  if (upper in PRE_SESSION_BATTERY_LABELS) {
    return PRE_SESSION_BATTERY_LABELS[upper as PreSessionBatteryCode]
  }
  const clientName = params.clientDisplayName?.trim()
  if (clientName) return clientName
  return params.assessmentName
}

export function isPreSessionBatteryCode(
  code: string
): code is PreSessionBatteryCode {
  return PRE_SESSION_BATTERY_CODES.includes(
    code.toUpperCase() as PreSessionBatteryCode
  )
}
