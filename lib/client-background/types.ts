export const RELATIONSHIP_TO_CLIENT = [
  "mother",
  "father",
  "parent",
  "step_parent",
  "other_caregiver",
  "sibling_full",
  "sibling_half",
  "sibling_step",
  "current_partner",
  "prior_partner",
  "child_biological",
  "child_step",
] as const
export type RelationshipToClient = (typeof RELATIONSHIP_TO_CLIENT)[number]

/** Types offered by Add relationship and by the type select. Mother and Father are always present and are not chosen here. */
export const ADDABLE_RELATIONSHIP_GROUPS: { label: string; roles: RelationshipToClient[] }[] = [
  { label: "Parents", roles: ["parent", "step_parent", "other_caregiver"] },
  { label: "Siblings", roles: ["sibling_full", "sibling_half", "sibling_step"] },
  { label: "Partners", roles: ["current_partner", "prior_partner"] },
  { label: "Children", roles: ["child_biological", "child_step"] },
]

export const ADDABLE_RELATIONSHIP_ROLES: RelationshipToClient[] = ADDABLE_RELATIONSHIP_GROUPS.flatMap(
  (group) => group.roles
)

export type RelationshipRelink =
  | { action: "move"; targetRecordId: string }
  | { action: "unlink" }

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
  "traumatic_event",
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
  other_caregiver: "Other primary caregiver",
  sibling_full: "Sibling",
  sibling_half: "Half-sibling",
  sibling_step: "Step-sibling",
  current_partner: "Current partner",
  prior_partner: "Prior partner",
  child_biological: "Child",
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
  traumatic_event: "Traumatic event",
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
export const EDUCATION_LEVEL_OPTIONS = [
  "Did not complete secondary",
  "Secondary",
  "Trade apprenticeship",
  "Certificate / diploma",
  "Bachelor degree",
  "Postgraduate",
  "Other",
]
export const CLIENT_RELATIONSHIP_STATUSES = [
  "single",
  "in_relationship_not_living_together",
  "engaged",
  "defacto",
  "married",
  "separated",
  "divorced",
  "widowed",
  "other",
] as const
export type ClientRelationshipStatus = (typeof CLIENT_RELATIONSHIP_STATUSES)[number]

export const CLIENT_RELATIONSHIP_STATUS_LABELS: Record<ClientRelationshipStatus, string> = {
  single: "Single",
  in_relationship_not_living_together: "In a relationship (not living together)",
  engaged: "Engaged",
  defacto: "De facto",
  married: "Married",
  separated: "Separated",
  divorced: "Divorced",
  widowed: "Widowed",
  other: "Other",
}

export type ClientRelationshipStatusValue = {
  relationshipStatus: ClientRelationshipStatus | ""
  relationshipStatusOther: string
}

/** Ratings on a relationship record. Empty means not recorded. */
export const RELATIONSHIP_RATING_VALUES = ["no", "somewhat", "yes"] as const
export type RelationshipRating = (typeof RELATIONSHIP_RATING_VALUES)[number]

export const RELATIONSHIP_RATING_LABELS: Record<RelationshipRating, string> = {
  no: "No",
  somewhat: "Somewhat",
  yes: "Yes",
}

export const WORK_STATUSES = [
  "full_time",
  "part_time",
  "casual",
  "self_employed",
  "unemployed",
  "student",
  "retired",
  "home_duties_or_carer",
  "unable_to_work",
  "other",
] as const
export type WorkStatus = (typeof WORK_STATUSES)[number]

export const EMPLOYED_WORK_STATUSES = ["full_time", "part_time", "casual", "self_employed"] as const

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
  self_employed: "Self-employed",
  unemployed: "Unemployed",
  student: "Student",
  retired: "Retired",
  home_duties_or_carer: "Home duties or carer",
  unable_to_work: "Unable to work",
  other: "Other",
}

export const LIVES_WITH_OPTIONS = [
  "alone",
  "with_partner",
  "with_partner_and_children",
  "with_children_sole_parent",
  "with_parents",
  "with_other_family",
  "with_flatmates_or_friends",
  "supported_or_residential",
  "no_fixed_address",
  "other",
] as const
export type LivesWith = (typeof LIVES_WITH_OPTIONS)[number]

export const LIVES_WITH_LABELS: Record<LivesWith, string> = {
  alone: "Alone",
  with_partner: "With partner",
  with_partner_and_children: "With partner and children",
  with_children_sole_parent: "With children (sole parent)",
  with_parents: "With parents",
  with_other_family: "With other family (for example grandparents, siblings or relatives)",
  with_flatmates_or_friends: "With flatmates or friends",
  supported_or_residential:
    "Supported or residential accommodation (for example a group home, rehab or aged care)",
  no_fixed_address: "No fixed address",
  other: "Other",
}
export const HOUSING_TYPE_OPTIONS = [
  "Own home",
  "Private rental",
  "Social or community housing",
  "Parent's home",
  "Shared housing",
  "Temporary housing",
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
  disability: boolean | null
  disabilityDetail: string
  accessibilityNeeds: string
}

export type LivingSituationFields = {
  housingType: string
  livesWith: LivesWith | ""
  livesWithOther: string
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
  started: string
  ended: string
}

export type NecessityAccess = Record<NecessityKey, boolean>

/** Screening answer stored for medication and stressors. Null means not answered yet. */
export const TRI_STATE_ANSWERS = ["yes", "no", "not_asked"] as const
export type TriStateAnswer = (typeof TRI_STATE_ANSWERS)[number]

/** Attended willingly. Somewhat is only used here. */
export const WILLINGNESS_ANSWERS = ["yes", "somewhat", "no", "not_asked"] as const
export type WillingnessAnswer = (typeof WILLINGNESS_ANSWERS)[number]

export type MedicationRecord = {
  currentlyTaking: TriStateAnswer | null
  previouslyTaken: TriStateAnswer | null
  supervisedBy: string
}

export const STRESSOR_ITEMS = [
  { key: "family", label: "Family" },
  { key: "socialLife", label: "Social life" },
  { key: "intimateRelationships", label: "Intimate relationships" },
  { key: "workStudy", label: "Work or study" },
  { key: "financial", label: "Financial" },
  { key: "ownHealth", label: "Your health" },
  { key: "othersHealth", label: "Health of significant others" },
  { key: "lossOfLovedOne", label: "Loss of a loved one" },
  { key: "legalPoliceAccidents", label: "Legal matters, police or accidents" },
] as const

export type StressorKey = (typeof STRESSOR_ITEMS)[number]["key"]

export type StressorsRecord = Record<StressorKey, TriStateAnswer | null> & {
  mainReason: string
}

/** Why the client came. Cleared fields stay empty unless the matching answer is Yes. */
export type ReasonForAttending = {
  referredByMedicalProfessional: TriStateAnswer | null
  /** professionals.professional_id in the same practice, or null. */
  referrerProfessionalId: string | null
  /** Partial date: YYYY, YYYY-MM, or YYYY-MM-DD. */
  referralDate: string
  referrerConcerns: string
  familyInvolved: TriStateAnswer | null
  familyInvolvement: string
  ownInitiative: TriStateAnswer | null
  attendedWillingly: WillingnessAnswer | null
  clientMotivation: string
}

export type OccupationFields = {
  workStatus: WorkStatus | ""
  workStatusOther: string
  role: string
  employer: string
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
  /** Partial date: YYYY, YYYY-MM, or YYYY-MM-DD. Cleared unless the person is deceased. */
  dateOfDeath: string
  healthOrCauseOfDeath: string
  lengthOfRelationship: string
  /** Prior partner: how the relationship ended. Cleared for every other role. */
  relationshipStatus: string
  timeSinceEnded: string
  supportive: RelationshipRating | ""
  conflict: RelationshipRating | ""
  /** Free-text comment under the supportive and conflict ratings. */
  qualityOfRelationship: string
  dependency: DependencyValue | ""
  livingSituation: RelationshipLivingSituation | ""
  /** Free text for other_caregiver, such as grandparent or foster carer. Cleared for every other role. */
  caregiverRelationship: string
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
  relationshipStatus: ClientRelationshipStatusValue
  demographics: Demographics
  medication: MedicationRecord
  stressors: StressorsRecord
  reason: ReasonForAttending
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
    disability: null,
    disabilityDetail: "",
    accessibilityNeeds: "",
  }
}

export function emptyClientRelationshipStatus(): ClientRelationshipStatusValue {
  return {
    relationshipStatus: "",
    relationshipStatusOther: "",
  }
}

export function emptyLivingSituation(): LivingSituationFields {
  return {
    housingType: "",
    livesWith: "",
    livesWithOther: "",
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

export function emptyMedication(): MedicationRecord {
  return {
    currentlyTaking: null,
    previouslyTaken: null,
    supervisedBy: "",
  }
}

export function emptyStressors(): StressorsRecord {
  return {
    family: null,
    socialLife: null,
    intimateRelationships: null,
    workStudy: null,
    financial: null,
    ownHealth: null,
    othersHealth: null,
    lossOfLovedOne: null,
    legalPoliceAccidents: null,
    mainReason: "",
  }
}

export function emptyReasonForAttending(): ReasonForAttending {
  return {
    referredByMedicalProfessional: null,
    referrerProfessionalId: null,
    referralDate: "",
    referrerConcerns: "",
    familyInvolved: null,
    familyInvolvement: "",
    ownInitiative: null,
    attendedWillingly: null,
    clientMotivation: "",
  }
}

export function triStateLabel(value: TriStateAnswer | null): string {
  if (value === "yes") return "Yes"
  if (value === "no") return "No"
  if (value === "not_asked") return "Not asked"
  return "Not recorded"
}

export function willingnessLabel(value: WillingnessAnswer | null): string {
  if (value === "yes") return "Yes"
  if (value === "somewhat") return "Somewhat"
  if (value === "no") return "No"
  if (value === "not_asked") return "Not asked"
  return "Not recorded"
}

export function emptyOccupation(): OccupationFields {
  return {
    workStatus: "",
    workStatusOther: "",
    role: "",
    employer: "",
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

export function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  return (options as readonly string[]).includes(value)
}
