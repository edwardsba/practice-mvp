export const RELATIONSHIP_TO_CLIENT = [
  "mother",
  "father",
  "parent",
  "step_parent",
  "sibling_full",
  "sibling_half",
  "sibling_step",
  "current_partner",
  "prior_partner",
  "child_biological",
  "child_step",
] as const
export type RelationshipToClient = (typeof RELATIONSHIP_TO_CLIENT)[number]

export const ORIGIN_PARENT_ROLES = ["mother", "father", "parent"] as const
export type OriginParentRole = (typeof ORIGIN_PARENT_ROLES)[number]

export const DEPENDENCY_VALUES = [
  "neither",
  "they_depend_on_me",
  "i_depend_on_them",
  "mutual",
] as const
export type DependencyValue = (typeof DEPENDENCY_VALUES)[number]

export const PARTNERSHIP_STATUSES = [
  "married",
  "defacto",
  "separated",
  "divorced",
  "widowed",
  "never_formalised",
] as const
export type PartnershipStatus = (typeof PARTNERSHIP_STATUSES)[number]

export const EVENT_TYPES = [
  "self_harm",
  "illness_injury",
  "substance_use",
  "psychiatric_admission",
  "previous_therapy",
  "emotional_problems",
  "family_events",
  "significant_history",
  "abuse",
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const START_PRECISIONS = ["year", "year_month", "date", "age"] as const
export type StartPrecision = (typeof START_PRECISIONS)[number]

export const RESOLVED_OR_ONGOING = ["ongoing", "resolved"] as const
export type ResolvedOrOngoing = (typeof RESOLVED_OR_ONGOING)[number]

export const ATTRIBUTIONS = ["self", "family", "self_linked"] as const
export type Attribution = (typeof ATTRIBUTIONS)[number]

export const FAMILY_SIDES = ["maternal", "paternal", "unspecified"] as const
export type FamilySide = (typeof FAMILY_SIDES)[number]

export const FAMILY_RELATION_PICKS = [
  "Mother",
  "Father",
  "Sibling",
  "Grandmother",
  "Grandfather",
  "Aunt",
  "Uncle",
  "Cousin",
  "Other",
] as const

export const SELF_HARM_TYPES = ["non_lethal", "potentially_lethal"] as const
export type SelfHarmType = (typeof SELF_HARM_TYPES)[number]

export const SUBSTANCE_STATUSES = ["active", "in_recovery", "abstinent"] as const
export type SubstanceStatus = (typeof SUBSTANCE_STATUSES)[number]

export const RATED_VALUES = ["not_reported", "no", "somewhat", "yes"] as const
export type RatedValue = (typeof RATED_VALUES)[number]

export const RELATIONSHIP_TO_CLIENT_LABELS: Record<RelationshipToClient, string> = {
  mother: "Mother",
  father: "Father",
  parent: "Parent",
  step_parent: "Step-parent",
  sibling_full: "Full sibling",
  sibling_half: "Half-sibling",
  sibling_step: "Step-sibling",
  current_partner: "Current partner",
  prior_partner: "Prior partner",
  child_biological: "Biological child",
  child_step: "Step-child",
}

export const DEPENDENCY_LABELS: Record<DependencyValue, string> = {
  neither: "Neither depends on the other",
  they_depend_on_me: "They depend on the client",
  i_depend_on_them: "The client depends on them",
  mutual: "Mutual",
}

export const PARTNERSHIP_STATUS_LABELS: Record<PartnershipStatus, string> = {
  married: "Married",
  defacto: "De facto",
  separated: "Separated",
  divorced: "Divorced",
  widowed: "Widowed",
  never_formalised: "Never formalised",
}

export const HEALTH_STATUSES = ["good", "fair", "poor", "deceased"] as const
export type HealthStatus = (typeof HEALTH_STATUSES)[number]

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  deceased: "Deceased",
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  self_harm: "Self-harm",
  illness_injury: "Illness / injury",
  substance_use: "Substance use",
  psychiatric_admission: "Psychiatric hospital admissions / residential rehab",
  previous_therapy: "Previous therapy",
  emotional_problems: "Emotional problems",
  family_events: "Family events",
  significant_history: "Significant history",
  abuse: "Abuse",
}

export const SELF_HARM_TYPE_LABELS: Record<SelfHarmType, string> = {
  non_lethal: "Non-lethal self-harm",
  potentially_lethal: "Potentially lethal (suicidal) self-harm behaviour",
}

export const SUBSTANCE_STATUS_LABELS: Record<SubstanceStatus, string> = {
  active: "Active use",
  in_recovery: "In recovery",
  abstinent: "Abstinent since",
}

export const FAMILY_SIDE_LABELS: Record<FamilySide, string> = {
  maternal: "Maternal",
  paternal: "Paternal",
  unspecified: "Unspecified",
}

export const RATED_VALUE_LABELS: Record<RatedValue, string> = {
  not_reported: "Not reported / not observed",
  no: "No",
  somewhat: "Somewhat",
  yes: "Yes",
}

export const SEX_OPTIONS = ["Female", "Male", "Another term", "Prefer not to say"] as const
export type SexOption = (typeof SEX_OPTIONS)[number]

export const RELATIONSHIP_LIVING_SITUATIONS = [
  "lives_with_client_full_time",
  "lives_with_client_part_time",
  "does_not_live_with_client",
  "previously_lived_with_client",
  "unknown",
] as const
export type RelationshipLivingSituation = (typeof RELATIONSHIP_LIVING_SITUATIONS)[number]

export const RELATIONSHIP_LIVING_SITUATION_LABELS: Record<RelationshipLivingSituation, string> = {
  lives_with_client_full_time: "Lives with client (full-time)",
  lives_with_client_part_time: "Lives with client (part-time or shared arrangement)",
  does_not_live_with_client: "Does not live with client",
  previously_lived_with_client: "Previously lived with client, not currently",
  unknown: "Unknown / not recorded",
}
export const PRONOUN_OPTIONS = ["she/her", "he/him", "they/them", "Other"]
export const EDUCATION_LEVEL_OPTIONS = [
  "Did not complete secondary",
  "Secondary",
  "Certificate / diploma",
  "Bachelor degree",
  "Postgraduate",
  "Other",
]
export const HOUSING_TYPE_OPTIONS = [
  "Owner-occupied",
  "Private rental",
  "Social / community housing",
  "Living with family",
  "Shared housing",
  "Temporary / unstable",
  "Other",
]
export const HOUSING_STABILITY_OPTIONS = ["Stable", "Some concern", "Unstable"]

export const NECESSITY_KEYS = [
  "food",
  "prescriptions",
  "transport",
  "leisure",
  "phoneInternet",
] as const
export type NecessityKey = (typeof NECESSITY_KEYS)[number]

export const NECESSITY_LABELS: Record<NecessityKey, string> = {
  food: "Food",
  prescriptions: "Prescriptions",
  transport: "Transport",
  leisure: "Leisure",
  phoneInternet: "Phone / internet",
}

export const RISK_FACTORS = [
  { key: "suicideSelfHarmHistory", label: "Suicide/self-harm history" },
  { key: "recentPsychiatricHospitalisation", label: "Recent psychiatric hospitalisation" },
  { key: "substanceUse", label: "Substance use" },
  { key: "accessToLethalMeans", label: "Access to lethal means" },
  { key: "perceivedBurdensomeness", label: "Perceived burdensomeness to others" },
  { key: "significantIllnessInjuryHistory", label: "Significant illness/injury history" },
  { key: "significantPsychiatricDiagnosisHistory", label: "Significant psychiatric diagnosis history" },
] as const

export const PROTECTIVE_FACTORS = [
  { key: "familySupport", label: "Family support" },
  { key: "pets", label: "Pets" },
  { key: "friendships", label: "Friendships" },
  { key: "religiousEngagement", label: "Religious engagement" },
  { key: "groupMembership", label: "Group membership" },
  { key: "reluctanceToAbandonDependents", label: "Reluctance to abandon dependents" },
  { key: "attachmentToTherapist", label: "Attachment to therapist / support provider" },
  { key: "fearOfSuicideDeathDying", label: "Fear of suicide, death and dying" },
  { key: "fearOfSocialDisapproval", label: "Fear of social disapproval of suicide" },
  { key: "beliefSuicideMorallyWrong", label: "Belief that suicide is morally wrong" },
  { key: "hopeForTheFuture", label: "Hope for the future" },
  { key: "confidenceToCope", label: "Confidence in ability to solve or cope with problems" },
] as const

export const RATED_FACTOR_KEYS = [
  ...RISK_FACTORS.map((item) => item.key),
  ...PROTECTIVE_FACTORS.map((item) => item.key),
] as const
export type RatedFactorKey = (typeof RATED_FACTOR_KEYS)[number]

export type RatedFactor = {
  value: RatedValue | ""
  comment: string
}

export type RiskRatings = Record<RatedFactorKey, RatedFactor>

export type IdentityFields = {
  sex: string
  genderDiffersFromSex: boolean
  genderIdentity: string
  pronouns: string
  pronounsOther: string
  raceEthnicity: string
  religion: string
  primaryLanguage: string
  disability: string
  accessibilityNeeds: string
}

export type LivingSituationFields = {
  livingArrangement: string
  clientDependsOnOthers: boolean | null
  clientDependsOnOthersDetail: string
  othersDependOnClient: boolean | null
  othersDependOnClientDetail: string
  householdComposition: string
  housingStability: string
}

export type EducationFields = {
  level: string
  fieldOfStudy: string
  currentlyStudying: boolean | null
  currentlyStudyingDetail: string
  disruption: boolean | null
  disruptionDetail: string
}

export type PreviousJob = {
  id: string
  role: string
  employer: string
  dates: string
}

export type NecessityAccess = Record<NecessityKey, boolean>

export type OccupationFields = {
  currentlyEmployed: boolean | null
  currentlyEmployedDetail: string
  previousJobs: PreviousJob[]
  financialConcerns: boolean | null
  financialConcernsDetail: string
  necessities: NecessityAccess
}

export type Demographics = {
  identity: IdentityFields
  livingSituation: LivingSituationFields
  education: EducationFields
  occupation: OccupationFields
}

export type RelationshipRecord = {
  relationshipRecordId: string
  relationshipToClient: RelationshipToClient
  sex: string
  givenName: string
  displayOrder: number
  /** Partial date: YYYY, YYYY-MM, or YYYY-MM-DD. Age is derived from this and is never stored. */
  dateOfBirth: string
  /** Retired. Cleared on read after conversion into a year-only dateOfBirth. */
  approximateAge: number | null
  approximateAgeRecordedOn: string
  healthStatus: HealthStatus | ""
  deceased: boolean
  ageAtDeath: number | null
  healthOrCauseOfDeath: string
  lengthOfRelationship: string
  relationshipStatus: string
  timeSinceEnded: string
  qualityOfRelationship: string
  dependency: DependencyValue | ""
  livingSituation: RelationshipLivingSituation | ""
  linkedPartnerRecordId: string | null
  partnershipRecordId: string | null
}

export type PartnershipRecord = {
  partnershipRecordId: string
  partnerAId: string
  partnerBId: string
  relationshipStatus: PartnershipStatus | ""
  started: string
  ended: string
  qualityOfRelationship: string
}

export type EventRecord = {
  eventRecordId: string
  eventType: EventType
  title: string
  description: string
  startPrecision: StartPrecision | ""
  startValue: string
  endPrecision: StartPrecision | ""
  endValue: string
  endOngoing: boolean
  resolvedOrOngoing: ResolvedOrOngoing | ""
  treated: boolean | null
  treatmentType: string
  treatmentDetail: string
  outcome: string
  attribution: Attribution
  familyRelation: string
  familySide: FamilySide | ""
  relationshipRecordId: string | null
  selfHarmType: SelfHarmType | ""
  substanceStatus: SubstanceStatus | ""
  abstinentSincePrecision: StartPrecision | ""
  abstinentSinceValue: string
  displayOrder: number
}

export type ClientBackgroundData = {
  dateOfBirth: string | null
  backgroundCapturedAt: string | null
  demographics: Demographics
  relationships: RelationshipRecord[]
  partnerships: PartnershipRecord[]
  events: EventRecord[]
  risk: RiskRatings
}

export function emptyRatedFactor(): RatedFactor {
  return { value: "", comment: "" }
}

export function emptyRisk(): RiskRatings {
  const risk = {} as RiskRatings
  for (const key of RATED_FACTOR_KEYS) {
    risk[key] = emptyRatedFactor()
  }
  return risk
}

export function emptyIdentity(): IdentityFields {
  return {
    sex: "",
    genderDiffersFromSex: false,
    genderIdentity: "",
    pronouns: "",
    pronounsOther: "",
    raceEthnicity: "",
    religion: "",
    primaryLanguage: "",
    disability: "",
    accessibilityNeeds: "",
  }
}

export function emptyLivingSituation(): LivingSituationFields {
  return {
    livingArrangement: "",
    clientDependsOnOthers: null,
    clientDependsOnOthersDetail: "",
    othersDependOnClient: null,
    othersDependOnClientDetail: "",
    householdComposition: "",
    housingStability: "",
  }
}

export function emptyEducation(): EducationFields {
  return {
    level: "",
    fieldOfStudy: "",
    currentlyStudying: null,
    currentlyStudyingDetail: "",
    disruption: null,
    disruptionDetail: "",
  }
}

export function emptyNecessities(): NecessityAccess {
  return {
    food: false,
    prescriptions: false,
    transport: false,
    leisure: false,
    phoneInternet: false,
  }
}

export function emptyOccupation(): OccupationFields {
  return {
    currentlyEmployed: null,
    currentlyEmployedDetail: "",
    previousJobs: [],
    financialConcerns: null,
    financialConcernsDetail: "",
    necessities: emptyNecessities(),
  }
}

export function emptyDemographics(): Demographics {
  return {
    identity: emptyIdentity(),
    livingSituation: emptyLivingSituation(),
    education: emptyEducation(),
    occupation: emptyOccupation(),
  }
}

export function emptyEvent(eventType: EventType, displayOrder: number): Omit<EventRecord, "eventRecordId"> {
  return {
    eventType,
    title: "",
    description: "",
    startPrecision: "",
    startValue: "",
    endPrecision: "",
    endValue: "",
    endOngoing: false,
    resolvedOrOngoing: "",
    treated: null,
    treatmentType: "",
    treatmentDetail: "",
    outcome: "",
    attribution: eventType === "family_events" ? "self_linked" : "self",
    familyRelation: "",
    familySide: "",
    relationshipRecordId: null,
    selfHarmType: "",
    substanceStatus: "",
    abstinentSincePrecision: "",
    abstinentSinceValue: "",
    displayOrder,
  }
}

export type CreateRelationshipInput =
  | { kind: "parent"; role: "mother" | "father" | "parent" }
  | { kind: "full_sibling"; partnershipRecordId: string | null }
  | { kind: "partner"; role: "current_partner" | "prior_partner" }
  | { kind: "unlinked_child"; role: "child_biological" | "child_step" }
  | { kind: "child"; partnerRecordId: string; role: "child_biological" | "child_step" }
  | { kind: "step_parent"; parentRecordId: string }
  | { kind: "step_sibling"; partnershipRecordId: string; role: "sibling_half" | "sibling_step" }

export function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  return (options as readonly string[]).includes(value)
}
