import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import type {
  BehaviouralTargetsJson,
  MultiSelectSectionJson,
  OngoingAssessmentsJson,
} from "@/lib/treatment-plans/types"

function parseBehaviouralTargets(
  value: unknown
): BehaviouralTargetsJson {
  if (!value || typeof value !== "object") return { items: [] }
  const items = (value as BehaviouralTargetsJson).items
  return {
    items: Array.isArray(items)
      ? items.map((item) => String(item).trim()).filter(Boolean)
      : [],
  }
}

function parseOngoingAssessments(value: unknown): OngoingAssessmentsJson {
  if (!value || typeof value !== "object") {
    return { phq9: false, gad7: false, assist: false }
  }
  const data = value as OngoingAssessmentsJson
  return {
    phq9: Boolean(data.phq9),
    gad7: Boolean(data.gad7),
    assist: Boolean(data.assist),
  }
}

function parseMultiSection(value: unknown): MultiSelectSectionJson {
  if (!value || typeof value !== "object") {
    return { selected: [], other: [] }
  }
  const data = value as MultiSelectSectionJson
  return {
    selected: Array.isArray(data.selected)
      ? data.selected.map((item) => String(item))
      : [],
    other: Array.isArray(data.other)
      ? data.other.map((item) => String(item).trim()).filter(Boolean)
      : [],
  }
}

export function rowToTreatmentPlan(row: {
  treatmentPlanId: string
  clientId: string
  practiceId: string
  practitionerProfileId: string
  versionNumber: number
  isActive: boolean
  startDate: string | null
  endDate: string | null
  therapeuticTarget: string | null
  behaviouralTargetsJson: unknown
  ongoingAssessmentsJson: unknown
  riskManagementJson: unknown
  supportServicesJson: unknown
  psychoeducationJson: unknown
  caseFormulationJson: unknown
  alternateResponsesJson: unknown
  qualityOfLifeJson: unknown
  createdAt: Date
  updatedAt: Date
}): TreatmentPlanRow {
  return {
    treatmentPlanId: row.treatmentPlanId,
    clientId: row.clientId,
    practiceId: row.practiceId,
    practitionerProfileId: row.practitionerProfileId,
    versionNumber: row.versionNumber,
    isActive: row.isActive,
    startDate: row.startDate,
    endDate: row.endDate,
    therapeuticTarget: row.therapeuticTarget,
    behaviouralTargetsJson: parseBehaviouralTargets(row.behaviouralTargetsJson),
    ongoingAssessmentsJson: parseOngoingAssessments(row.ongoingAssessmentsJson),
    riskManagementJson: parseMultiSection(row.riskManagementJson),
    supportServicesJson: parseMultiSection(row.supportServicesJson),
    psychoeducationJson: parseMultiSection(row.psychoeducationJson),
    caseFormulationJson: parseMultiSection(row.caseFormulationJson),
    alternateResponsesJson: parseMultiSection(row.alternateResponsesJson),
    qualityOfLifeJson: parseMultiSection(row.qualityOfLifeJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
