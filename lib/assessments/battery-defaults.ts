import {
  BATTERY_ASSESSMENT_CODES,
  BATTERY_ASSESSMENT_LABELS,
  DEFAULT_BATTERY_CODES,
  type BatteryAssessmentCode,
} from "@/lib/assessments/battery-codes"
import type { SendableAssessment } from "@/lib/assessments/sendable-assessments"
import type { OngoingAssessmentsJson } from "@/lib/treatment-plans/types"

export type BatteryAssessmentChip = {
  code: string
  label: string
  selected: boolean
}

/**
 * Default pre-session battery chips only (BTP/PHQ9/GAD7/ASSIST).
 * Used by automations and Resend battery — unchanged behaviour.
 */
export function getDefaultBatteryAssessments(
  ongoingAssessments: OngoingAssessmentsJson | null | undefined,
  smartGoalItems: string[] = []
): BatteryAssessmentChip[] {
  const hasSmartGoals = smartGoalItems.length > 0
  const availableCodes = BATTERY_ASSESSMENT_CODES.filter(
    (code) => code !== "BTP" || hasSmartGoals
  )

  if (!ongoingAssessments) {
    return availableCodes.map((code) => ({
      code,
      label: BATTERY_ASSESSMENT_LABELS[code],
      selected:
        code === "BTP"
          ? hasSmartGoals
          : DEFAULT_BATTERY_CODES.includes(code),
    }))
  }

  const phq9 = ongoingAssessments.phq9
  const gad7 = ongoingAssessments.gad7
  const assist = ongoingAssessments.assist

  const usePlanSelections = phq9 || gad7 || assist

  return availableCodes.map((code) => {
    let selected = false
    if (code === "BTP") {
      selected = hasSmartGoals
    } else if (!usePlanSelections) {
      selected = DEFAULT_BATTERY_CODES.includes(code)
    } else if (code === "PHQ9") {
      selected = phq9
    } else if (code === "GAD7") {
      selected = gad7
    } else {
      selected = assist
    }

    return {
      code,
      label: BATTERY_ASSESSMENT_LABELS[code],
      selected,
    }
  })
}

/**
 * Full Send-assessment chip list: every sendable assessment, with the same
 * default selection rules as the pre-session battery for BTP/PHQ9/GAD7/ASSIST.
 * Other sendable instruments start unselected. BTP is omitted without SMART goals.
 */
export function buildSendAssessmentChips(
  sendable: SendableAssessment[],
  ongoingAssessments: OngoingAssessmentsJson | null | undefined,
  smartGoalItems: string[] = []
): BatteryAssessmentChip[] {
  const defaults = getDefaultBatteryAssessments(
    ongoingAssessments,
    smartGoalItems
  )
  const selectedByCode = new Map(
    defaults.map((chip) => [chip.code.toUpperCase(), chip.selected])
  )
  const hasSmartGoals = smartGoalItems.length > 0

  return sendable
    .filter((item) => {
      if (item.assessmentCode.toUpperCase() !== "BTP") return true
      return hasSmartGoals
    })
    .map((item) => {
      const upper = item.assessmentCode.toUpperCase()
      const selected = selectedByCode.get(upper) ?? false
      return {
        code: item.assessmentCode,
        label: item.displayLabel,
        selected,
      }
    })
}

export function selectedBatteryCodes(
  assessments: BatteryAssessmentChip[]
): string[] {
  return assessments.filter((item) => item.selected).map((item) => item.code)
}

export function batteryCodesFromTreatmentPlan(
  ongoingAssessments: OngoingAssessmentsJson | null | undefined,
  smartGoalItems: string[] = []
): BatteryAssessmentCode[] {
  return selectedBatteryCodes(
    getDefaultBatteryAssessments(ongoingAssessments, smartGoalItems)
  ) as BatteryAssessmentCode[]
}
