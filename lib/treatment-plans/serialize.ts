import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import type {
  MedicationSupervisionJson,
  MultiSelectSectionJson,
  OngoingAssessmentsJson,
  SingleSelectSectionJson,
  SmartGoalsJson,
  SuicideAttemptRecord,
  SuicideAttemptsJson,
} from "@/lib/treatment-plans/types"

function parseSmartGoals(value: unknown): SmartGoalsJson {
  if (!value || typeof value !== "object") return { items: [] }
  const items = (value as SmartGoalsJson).items
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

function parseSingleSection(value: unknown): SingleSelectSectionJson {
  if (!value || typeof value !== "object") return { selected: null }
  const data = value as SingleSelectSectionJson
  return { selected: typeof data.selected === "string" ? data.selected : null }
}

function parseMedicationSupervision(value: unknown): MedicationSupervisionJson {
  if (!value || typeof value !== "object") {
    return { supervised: false, supervisorName: null }
  }
  const data = value as MedicationSupervisionJson
  return {
    supervised: Boolean(data.supervised),
    supervisorName:
      typeof data.supervisorName === "string" && data.supervisorName.trim()
        ? data.supervisorName.trim()
        : null,
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
  diagnosis: string | null
  diagnosisReportDate: string | null
  therapeuticTarget: string | null
  smartGoalsJson: unknown
  treatmentModalitiesJson: unknown
  suicideAttemptsJson: unknown
  ongoingAssessmentsJson: unknown
  medicationSupervisionJson: unknown
  supportServicesJson: unknown
  treatmentModelJson: unknown
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
    diagnosis: row.diagnosis,
    diagnosisReportDate: row.diagnosisReportDate,
    therapeuticTarget: row.therapeuticTarget,
    smartGoalsJson: parseSmartGoals(row.smartGoalsJson),
    treatmentModalitiesJson: parseMultiSection(row.treatmentModalitiesJson),
    suicideAttemptsJson: parseSuicideAttempts(row.suicideAttemptsJson),
    ongoingAssessmentsJson: parseOngoingAssessments(row.ongoingAssessmentsJson),
    medicationSupervisionJson: parseMedicationSupervision(
      row.medicationSupervisionJson
    ),
    supportServicesJson: parseMultiSection(row.supportServicesJson),
    treatmentModelJson: parseSingleSection(row.treatmentModelJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
