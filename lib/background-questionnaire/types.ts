import type {
  ClientRelationshipStatus,
  LivesWith,
  NecessityKey,
  SexOption,
  WorkStatus,
} from "@/lib/client-background/types"

export const BACKGROUND_ASSESSMENT_CODE = "BACKGROUND_SR"

export const HOUSING_TYPE_VALUES = [
  "own_home",
  "private_rental",
  "social_housing",
  "parents_home",
  "shared_housing",
  "temporary_housing",
  "other",
] as const
export type HousingTypeValue = (typeof HOUSING_TYPE_VALUES)[number]

export const HOUSING_SECURITY_VALUES = ["secure", "some_concerns", "at_risk"] as const
export type HousingSecurityValue = (typeof HOUSING_SECURITY_VALUES)[number]

export type BackgroundAboutYou = {
  sex: SexOption | null
  genderIdentity: string
  pronouns: string
  raceEthnicity: string
  religion: string
  primaryLanguage: string
  disability: boolean | null
  disabilityDetail: string
}

export type BackgroundStudyWork = {
  level: string | null
  fieldOfStudy: string
  currentlyStudying: boolean | null
  currentlyStudyingDetail: string
  disruption: boolean | null
  disruptionDetail: string
  workStatus: WorkStatus | null
  workStatusOther: string
  role: string
  employer: string
  recentJobRole: string
  recentJobEmployer: string
  necessities: NecessityKey[]
}

export type BackgroundFamilyHome = {
  relationshipStatus: ClientRelationshipStatus | null
  relationshipStatusOther: string
  numberOfChildren: number | null
  housingType: HousingTypeValue | null
  housingTypeOther: string
  livesWith: LivesWith | null
  livesWithOther: string
  housingSecurity: HousingSecurityValue | null
}

export type BackgroundTreatmentHistory = {
  hospitalForEmotionalProblem: boolean | null
  therapyForEmotionalIssues: boolean | null
  currentMedication: boolean | null
  everTakenMedication: boolean | null
  familyEmotionalProblem: boolean | null
  familyAlcoholOrDrugs: boolean | null
  familyHospitalForEmotionalOrSubstance: boolean | null
}

export type BackgroundStressors = {
  family: boolean | null
  socialLife: boolean | null
  intimateRelationships: boolean | null
  workOrStudy: boolean | null
  financial: boolean | null
  yourHealth: boolean | null
  healthOfSignificantOthers: boolean | null
  lossOfLovedOne: boolean | null
  legalMatters: boolean | null
  mainReason: string
}

export type BackgroundAnswers = {
  version: 1
  aboutYou: BackgroundAboutYou
  studyWork: BackgroundStudyWork
  familyHome: BackgroundFamilyHome
  treatmentHistory: BackgroundTreatmentHistory
  stressors: BackgroundStressors
}

export type BackgroundPartKey = keyof Omit<BackgroundAnswers, "version">
