import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import type {
  BehaviouralTargetsJson,
  MultiSelectSectionJson,
  OngoingAssessmentsJson,
  SuicideAttemptRecord,
  SuicideAttemptsJson,
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

function parseSuicideAttempts(value: unknown): SuicideAttemptsJson {
  if (!value || typeof value !== "object") return { items: [] }
  const items = (value as SuicideAttemptsJson).items
  if (!Array.isArray(items)) return { items: [] }

  const parsed: SuicideAttemptRecord[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const record = item as SuicideAttemptRecord
    const year = Number(record.year)
    if (!Number.isFinite(year)) continue
    parsed.push({
      id: String(record.id || crypto.randomUUID()),
      year,
      month:
        record.month != null && Number.isFinite(Number(record.month))
          ? Number(record.month)
          : null,
      day:
        record.day != null && Number.isFinite(Number(record.day))
          ? Number(record.day)
          : null,
      notes: record.notes?.trim() || null,
    })
  }

  return { items: parsed }
}

export function suicideAttemptItemsFromJson(value: unknown): SuicideAttemptRecord[] {
  return parseSuicideAttempts(value).items
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
  suicideAttemptsJson: unknown
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
    suicideAttemptsJson: parseSuicideAttempts(row.suicideAttemptsJson),
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
