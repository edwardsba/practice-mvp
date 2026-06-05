import {
  BATTERY_ASSESSMENT_CODES,
  BATTERY_ASSESSMENT_LABELS,
  DEFAULT_BATTERY_CODES,
  type BatteryAssessmentCode,
} from "@/lib/assessments/battery-codes"
import type { OngoingAssessmentsJson } from "@/lib/treatment-plans/types"

export type BatteryAssessmentChip = {
  code: BatteryAssessmentCode
  label: string
  selected: boolean
}

export function getDefaultBatteryAssessments(
  ongoingAssessments: OngoingAssessmentsJson | null | undefined,
  behaviouralTargetItems: string[] = []
): BatteryAssessmentChip[] {
  const hasBehaviouralTargets = behaviouralTargetItems.length > 0
  const availableCodes = BATTERY_ASSESSMENT_CODES.filter(
    (code) => code !== "BTP" || hasBehaviouralTargets
  )

  if (!ongoingAssessments) {
    return availableCodes.map((code) => ({
      code,
      label: BATTERY_ASSESSMENT_LABELS[code],
      selected:
        code === "BTP"
          ? hasBehaviouralTargets
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
      selected = hasBehaviouralTargets
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

export function selectedBatteryCodes(
  assessments: BatteryAssessmentChip[]
): BatteryAssessmentCode[] {
  return assessments.filter((item) => item.selected).map((item) => item.code)
}

export function batteryCodesFromTreatmentPlan(
  ongoingAssessments: OngoingAssessmentsJson | null | undefined,
  behaviouralTargetItems: string[] = []
): BatteryAssessmentCode[] {
  return selectedBatteryCodes(
    getDefaultBatteryAssessments(ongoingAssessments, behaviouralTargetItems)
  )
}
