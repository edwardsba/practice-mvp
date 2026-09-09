import type { CheckboxOption } from "@/lib/treatment-plans/fields"
import {
  ONGOING_ASSESSMENT_OPTIONS,
  TREATMENT_MODALITY_OPTIONS,
  TREATMENT_MODEL_OPTIONS,
  flattenSupportServiceOptions,
} from "@/lib/treatment-plans/fields"
import type {
  MedicationSupervisionJson,
  MultiSelectSectionJson,
  OngoingAssessmentsJson,
  SingleSelectSectionJson,
  SmartGoalsJson,
  SuicideAttemptRecord,
  SuicideAttemptsJson,
  TreatmentPlanFormValues,
} from "@/lib/treatment-plans/types"

function parseDateField(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim()
  return raw || null
}

function parseMultiSection(
  formData: FormData,
  prefix: string,
  options: CheckboxOption[]
): MultiSelectSectionJson {
  const selected = options
    .filter((option) => formData.get(`${prefix}_${option.key}`) === "on")
    .map((option) => option.key)

  const other = formData
    .getAll(`${prefix}_other`)
    .map((value) => String(value).trim())
    .filter(Boolean)

  return { selected, other }
}

function parseSingleSection(
  formData: FormData,
  name: string,
  options: CheckboxOption[]
): SingleSelectSectionJson {
  const raw = String(formData.get(name) ?? "").trim()
  const selected = options.some((option) => option.key === raw) ? raw : null
  return { selected: selected || null }
}

function parseOngoingAssessments(formData: FormData): OngoingAssessmentsJson {
  const result: OngoingAssessmentsJson = {
    phq9: false,
    gad7: false,
    assist: false,
  }

  for (const option of ONGOING_ASSESSMENT_OPTIONS) {
    if (formData.get(`ongoing_${option.key}`) === "on") {
      result[option.key as keyof OngoingAssessmentsJson] = true
    }
  }

  return result
}

function parseSmartGoals(formData: FormData): SmartGoalsJson {
  const items = formData
    .getAll("smart_goals")
    .map((value) => String(value).trim())
    .filter(Boolean)

  return { items }
}

function parseMedicationSupervision(formData: FormData): MedicationSupervisionJson {
  const supervised = formData.get("medication_supervised") === "on"
  const supervisorName = String(
    formData.get("medication_supervisor_name") ?? ""
  ).trim()

  return {
    supervised,
    supervisorName: supervised && supervisorName ? supervisorName : null,
  }
}

function parseSuicideAttempts(formData: FormData): SuicideAttemptsJson {
  const ids = formData.getAll("suicide_attempt_id").map(String)
  const years = formData.getAll("suicide_attempt_year").map(String)
  const months = formData.getAll("suicide_attempt_month").map(String)
  const days = formData.getAll("suicide_attempt_day").map(String)
  const notes = formData.getAll("suicide_attempt_notes").map(String)

  const items: SuicideAttemptRecord[] = []

  for (let i = 0; i < years.length; i++) {
    const year = parseInt(years[i], 10)
    if (!Number.isFinite(year)) continue

    const month = parseInt(months[i], 10)
    const day = parseInt(days[i], 10)

    items.push({
      id: ids[i] || crypto.randomUUID(),
      year,
      month: Number.isFinite(month) ? month : null,
      day: Number.isFinite(day) ? day : null,
      notes: notes[i]?.trim() || null,
    })
  }

  return { items }
}

export function parseTreatmentPlanFormData(
  formData: FormData
): TreatmentPlanFormValues {
  return {
    startDate: parseDateField(formData.get("start_date")),
    endDate: parseDateField(formData.get("end_date")),
    diagnosis: String(formData.get("diagnosis") ?? "").trim() || null,
    diagnosisReportDate: parseDateField(formData.get("diagnosis_report_date")),
    therapeuticTarget:
      String(formData.get("therapeutic_target") ?? "").trim() || null,
    smartGoals: parseSmartGoals(formData),
    treatmentModalities: parseMultiSection(
      formData,
      "modality",
      TREATMENT_MODALITY_OPTIONS
    ),
    suicideAttempts: parseSuicideAttempts(formData),
    ongoingAssessments: parseOngoingAssessments(formData),
    medicationSupervision: parseMedicationSupervision(formData),
    supportServices: parseMultiSection(
      formData,
      "support",
      flattenSupportServiceOptions()
    ),
    treatmentModel: parseSingleSection(
      formData,
      "treatment_model",
      TREATMENT_MODEL_OPTIONS
    ),
  }
}

export function formValuesToDbColumns(values: TreatmentPlanFormValues) {
  return {
    startDate: values.startDate,
    endDate: values.endDate,
    diagnosis: values.diagnosis,
    diagnosisReportDate: values.diagnosisReportDate,
    therapeuticTarget: values.therapeuticTarget,
    smartGoalsJson: values.smartGoals,
    treatmentModalitiesJson: values.treatmentModalities,
    suicideAttemptsJson: values.suicideAttempts,
    ongoingAssessmentsJson: values.ongoingAssessments,
    medicationSupervisionJson: values.medicationSupervision,
    supportServicesJson: values.supportServices,
    treatmentModelJson: values.treatmentModel,
  }
}
