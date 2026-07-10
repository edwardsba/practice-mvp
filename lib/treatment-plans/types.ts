export type BehaviouralTargetsJson = {
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

export type TreatmentPlanFormValues = {
  startDate: string | null
  endDate: string | null
  therapeuticTarget: string | null
  behaviouralTargets: BehaviouralTargetsJson
  suicideAttempts: SuicideAttemptsJson
  ongoingAssessments: OngoingAssessmentsJson
  riskManagement: MultiSelectSectionJson
  supportServices: MultiSelectSectionJson
  psychoeducation: MultiSelectSectionJson
  caseFormulation: MultiSelectSectionJson
  alternateResponses: MultiSelectSectionJson
  qualityOfLife: MultiSelectSectionJson
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
  therapeuticTarget: string | null
  behaviouralTargetsJson: BehaviouralTargetsJson | null
  suicideAttemptsJson: SuicideAttemptsJson | null
  ongoingAssessmentsJson: OngoingAssessmentsJson | null
  riskManagementJson: MultiSelectSectionJson | null
  supportServicesJson: MultiSelectSectionJson | null
  psychoeducationJson: MultiSelectSectionJson | null
  caseFormulationJson: MultiSelectSectionJson | null
  alternateResponsesJson: MultiSelectSectionJson | null
  qualityOfLifeJson: MultiSelectSectionJson | null
  createdAt: Date
  updatedAt: Date
}
