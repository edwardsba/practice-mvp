import type { CheckboxOption } from "@/lib/treatment-plans/fields"
import {
  ONGOING_ASSESSMENT_OPTIONS,
  RISK_MANAGEMENT_OPTIONS,
  SUPPORT_SERVICES_OPTIONS,
  PSYCHOEDUCATION_OPTIONS,
  CASE_FORMULATION_OPTIONS,
  ALTERNATE_RESPONSES_OPTIONS,
  QUALITY_OF_LIFE_OPTIONS,
  TREATMENT_MODALITY_OPTIONS,
} from "@/lib/treatment-plans/fields"
import type {
  BehaviouralTargetsJson,
  MultiSelectSectionJson,
  OngoingAssessmentsJson,
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

function parseBehaviouralTargets(formData: FormData): BehaviouralTargetsJson {
  const items = formData
    .getAll("behavioural_targets")
    .map((value) => String(value).trim())
    .filter(Boolean)

  return { items }
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
    therapeuticTarget:
      String(formData.get("therapeutic_target") ?? "").trim() || null,
    behaviouralTargets: parseBehaviouralTargets(formData),
    treatmentModalities: parseMultiSection(
      formData,
      "modality",
      TREATMENT_MODALITY_OPTIONS
    ),
    suicideAttempts: parseSuicideAttempts(formData),
    ongoingAssessments: parseOngoingAssessments(formData),
    riskManagement: parseMultiSection(
      formData,
      "risk",
      RISK_MANAGEMENT_OPTIONS
    ),
    supportServices: parseMultiSection(
      formData,
      "support",
      SUPPORT_SERVICES_OPTIONS
    ),
    psychoeducation: parseMultiSection(
      formData,
      "psycho",
      PSYCHOEDUCATION_OPTIONS
    ),
    caseFormulation: parseMultiSection(
      formData,
      "case",
      CASE_FORMULATION_OPTIONS
    ),
    alternateResponses: parseMultiSection(
      formData,
      "alternate",
      ALTERNATE_RESPONSES_OPTIONS
    ),
    qualityOfLife: parseMultiSection(
      formData,
      "qol",
      QUALITY_OF_LIFE_OPTIONS
    ),
  }
}

export function formValuesToDbColumns(values: TreatmentPlanFormValues) {
  return {
    startDate: values.startDate,
    endDate: values.endDate,
    diagnosis: values.diagnosis,
    therapeuticTarget: values.therapeuticTarget,
    behaviouralTargetsJson: values.behaviouralTargets,
    treatmentModalitiesJson: values.treatmentModalities,
    suicideAttemptsJson: values.suicideAttempts,
    ongoingAssessmentsJson: values.ongoingAssessments,
    riskManagementJson: values.riskManagement,
    supportServicesJson: values.supportServices,
    psychoeducationJson: values.psychoeducation,
    caseFormulationJson: values.caseFormulation,
    alternateResponsesJson: values.alternateResponses,
    qualityOfLifeJson: values.qualityOfLife,
  }
}
