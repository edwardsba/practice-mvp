export type SmartGoalsJson = {
  items: string[]
}

export type SuicideAttemptRecord = {
  id: string
  year: number
  month?: number | null
  day?: number | null
  notes?: string | null
}

export type SuicideAttemptsJson = {
  items: SuicideAttemptRecord[]
}

export type OngoingAssessmentsJson = {
  phq9: boolean
  gad7: boolean
  assist: boolean
}

export type MultiSelectSectionJson = {
  selected: string[]
  other: string[]
}

// Single-select equivalent of MultiSelectSectionJson, for fields where exactly one
// (or zero) option applies — e.g. Treatment Model.
export type SingleSelectSectionJson = {
  selected: string | null
}

export type MedicationSupervisionJson = {
  supervised: boolean
  supervisorName: string | null
}

export type TreatmentPlanFormValues = {
  startDate: string | null
  endDate: string | null
  // Manually entered for now; will be autofilled once the standalone diagnostic
  // feature exists (see the comment on the schema column).
  diagnosis: string | null
  diagnosisReportDate: string | null
  therapeuticTarget: string | null
  smartGoals: SmartGoalsJson
  treatmentModalities: MultiSelectSectionJson
  suicideAttempts: SuicideAttemptsJson
  ongoingAssessments: OngoingAssessmentsJson
  medicationSupervision: MedicationSupervisionJson
  supportServices: MultiSelectSectionJson
  treatmentModel: SingleSelectSectionJson
}

export type TreatmentPlanRow = {
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
  smartGoalsJson: SmartGoalsJson | null
  treatmentModalitiesJson: MultiSelectSectionJson | null
  suicideAttemptsJson: SuicideAttemptsJson | null
  ongoingAssessmentsJson: OngoingAssessmentsJson | null
  medicationSupervisionJson: MedicationSupervisionJson | null
  supportServicesJson: MultiSelectSectionJson | null
  treatmentModelJson: SingleSelectSectionJson | null
  createdAt: Date
  updatedAt: Date
}
