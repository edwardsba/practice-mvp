import type { HowEnded } from "@/lib/client-background/how-ended"
import type { LaterRelationships } from "@/lib/client-background/later-relationships"

export const RELATIONSHIP_TO_CLIENT = [
  "mother",
  "father",
  "parent",
  "step_parent",
  "other_caregiver",
  "sibling_full",
  "sibling_half",
  "sibling_step",
  "sibling_adoptive",
  "current_partner",
  "prior_partner",
  "child_biological",
  "child_step",
] as const
export type RelationshipToClient = (typeof RELATIONSHIP_TO_CLIENT)[number]

/** Types offered by Add relationship and by the type select. Mother and Father are always present and are not chosen here. */
export const ADDABLE_RELATIONSHIP_GROUPS: { label: string; roles: RelationshipToClient[] }[] = [
  { label: "Parents", roles: ["parent", "step_parent", "other_caregiver"] },
  { label: "Siblings", roles: ["sibling_full", "sibling_half", "sibling_step", "sibling_adoptive"] },
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
  "medication",
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
  sibling_adoptive: "Adoptive sibling",
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

/** Prior partner relationship type. The current partner's type is the client's relationship status. */
export const PARTNER_TYPES = ["married", "defacto", "engaged", "dating", "other"] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  married: "Married",
  defacto: "De facto",
  engaged: "Engaged",
  dating: "Dating",
  other: "Other",
}

export const PARENT_TYPES = ["biological", "adoptive"] as const
export type ParentType = (typeof PARENT_TYPES)[number]

export const PARENT_TYPE_LABELS: Record<ParentType, string> = {
  biological: "Biological",
  adoptive: "Adoptive",
}

export const CHILD_TYPES = ["biological", "adopted", "step_child", "foster", "other"] as const
export type ChildType = (typeof CHILD_TYPES)[number]

export const CHILD_TYPE_LABELS: Record<ChildType, string> = {
  biological: "Biological",
  adopted: "Adopted",
  step_child: "Step-child",
  foster: "Foster",
  other: "Other (describe)",
}

export const HISTORY_ABOUT = ["self", "significant_other"] as const
export type HistoryAbout = (typeof HISTORY_ABOUT)[number]

/** Biological child whose other parent is not one of the recorded partners. */
export const OTHER_PARENT_KINDS = ["donor_conception", "adopted_sole", "other"] as const
export type OtherParentKind = (typeof OTHER_PARENT_KINDS)[number]

export const OTHER_PARENT_KIND_LABELS: Record<OtherParentKind, string> = {
  donor_conception: "Donor conception",
  adopted_sole: "Adopted as a sole parent",
  other: "Other",
}

export const CAREGIVER_RELATIONSHIPS = [
  "grandparent",
  "other_relative",
  "family_friend",
  "foster_carer",
  "kinship_carer",
  "residential",
  "other",
] as const
export type CaregiverRelationship = (typeof CAREGIVER_RELATIONSHIPS)[number]

export const CAREGIVER_RELATIONSHIP_LABELS: Record<CaregiverRelationship, string> = {
  grandparent: "Grandparent",
  other_relative: "Other relative",
  family_friend: "Family friend",
  foster_carer: "Foster carer",
  kinship_carer: "Kinship carer",
  residential: "Residential / out-of-home care",
  other: "Other",
}

export const ADMISSION_TYPES = [
  "psychiatric_inpatient",
  "residential_rehab",
  "medical",
  "emergency_department",
] as const
export type AdmissionType = (typeof ADMISSION_TYPES)[number]

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  psychiatric_inpatient: "Psychiatric inpatient",
  residential_rehab: "Residential rehab",
  medical: "Medical",
  emergency_department: "Emergency department only",
}

export const CONDITION_EVENT_TYPES = ["illness_injury", "emotional_problems", "substance_use"] as const
export type ConditionEventType = (typeof CONDITION_EVENT_TYPES)[number]

export const TREATMENT_EVENT_TYPES = ["psychiatric_admission", "previous_therapy", "medication"] as const
export type TreatmentEventType = (typeof TREATMENT_EVENT_TYPES)[number]

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
  psychiatric_admission: "Hospital admission",
  previous_therapy: "Previous therapy",
  medication: "Medication",
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
  "dating",
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
  dating: "Dating",
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

/** A relationship is the unit. People sit in one block, and their role comes from that block. */
export const BLOCK_KINDS = [
  "client_current",
  "client_previous",
  "client_other_children",
  "biological_parents",
  "parent_other",
  "caregiver_arrangement",
] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

export const BLOCK_ROLES = ["partner", "child", "parent", "sibling", "caregiver"] as const
export type BlockRole = (typeof BLOCK_ROLES)[number]

export const BLOCK_ANSWERS = ["yes", "none", "not_asked"] as const
export type BlockAnswer = (typeof BLOCK_ANSWERS)[number]

export const CURRENT_BLOCK_STATUSES = [
  "married",
  "defacto",
  "engaged",
  "dating",
  "in_relationship_not_living_together",
  "other",
] as const
export type CurrentBlockStatus = (typeof CURRENT_BLOCK_STATUSES)[number]

export const PREVIOUS_BLOCK_STATUSES = [
  "divorced",
  "married_separated",
  "defacto_separated",
  "engagement_ended",
  "relationship_ended",
  "widowed",
  "partner_died",
  "other",
] as const
export type PreviousBlockStatus = (typeof PREVIOUS_BLOCK_STATUSES)[number]

/** Biological parents only. A parent's other relationship uses both lists without this. */
export const NEVER_IN_A_RELATIONSHIP = "never_in_a_relationship" as const

export const ARRANGEMENT_TYPES = [
  "adoption",
  "grandparent_care",
  "kinship_care",
  "foster_care",
  "residential",
  "other",
] as const
export type ArrangementType = (typeof ARRANGEMENT_TYPES)[number]

export const SIBLING_BLOCK_TYPES = ["full", "half", "step", "adoptive", "foster", "other"] as const
export type SiblingBlockType = (typeof SIBLING_BLOCK_TYPES)[number]

export const PARENT_BLOCK_TYPES = ["mother", "father"] as const
export type ParentBlockType = (typeof PARENT_BLOCK_TYPES)[number]

export const CURRENT_BLOCK_STATUS_LABELS: Record<CurrentBlockStatus, string> = {
  married: "Married",
  defacto: "De facto",
  engaged: "Engaged",
  dating: "Dating",
  in_relationship_not_living_together: "In a relationship, not living together",
  other: "Other",
}

export const PREVIOUS_BLOCK_STATUS_LABELS: Record<PreviousBlockStatus, string> = {
  divorced: "Divorced",
  married_separated: "Married, separated",
  defacto_separated: "De facto, separated",
  engagement_ended: "Engagement ended",
  relationship_ended: "Relationship ended",
  widowed: "Widowed",
  partner_died: "Partner died",
  other: "Other",
}

export const ARRANGEMENT_TYPE_LABELS: Record<ArrangementType, string> = {
  adoption: "Adoption",
  grandparent_care: "Grandparent care",
  kinship_care: "Kinship care",
  foster_care: "Foster care",
  residential: "Residential / out-of-home care",
  other: "Other",
}

export const SIBLING_BLOCK_TYPE_LABELS: Record<SiblingBlockType, string> = {
  full: "Full",
  half: "Half",
  step: "Step",
  adoptive: "Adoptive",
  foster: "Foster",
  other: "Other",
}

export const BLOCK_ANSWER_LABELS: Record<BlockAnswer, string> = {
  yes: "Yes",
  none: "None",
  not_asked: "Not asked",
}

/** Statuses that open the client's first current relationship. */
export const PARTNERED_CLIENT_STATUSES = [
  "in_relationship_not_living_together",
  "engaged",
  "dating",
  "defacto",
  "married",
] as const

export type RelationshipBlock = {
  relationshipBlockId: string
  kind: BlockKind
  /** Parent's other relationship: the mother or father this block belongs to. */
  parentRecordId: string | null
  parentSide: ParentBlockType | ""
  status: string
  statusDetail: string
  arrangementType: ArrangementType | ""
  arrangementDetail: string
  startedOn: string
  endedOn: string
  noChildren: boolean
  displayOrder: number
}

export type RelationshipBlockAnswers = {
  previousRelationships: BlockAnswer | ""
  otherChildren: BlockAnswer | ""
  motherOtherRelationships: BlockAnswer | ""
  fatherOtherRelationships: BlockAnswer | ""
  caregiverArrangements: BlockAnswer | ""
}

export function emptyBlockAnswers(): RelationshipBlockAnswers {
  return {
    previousRelationships: "not_asked",
    otherChildren: "not_asked",
    motherOtherRelationships: "not_asked",
    fatherOtherRelationships: "not_asked",
    caregiverArrangements: "not_asked",
  }
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

export const SEXUAL_ORIENTATIONS = [
  "heterosexual",
  "gay",
  "lesbian",
  "bisexual",
  "pansexual",
  "asexual",
  "queer",
  "another",
  "prefer_not_to_say",
] as const
export type SexualOrientation = (typeof SEXUAL_ORIENTATIONS)[number]

export const SEXUAL_ORIENTATION_LABELS: Record<SexualOrientation, string> = {
  heterosexual: "Heterosexual",
  gay: "Gay",
  lesbian: "Lesbian",
  bisexual: "Bisexual",
  pansexual: "Pansexual",
  asexual: "Asexual",
  queer: "Queer",
  another: "Another term (describe)",
  prefer_not_to_say: "Prefer not to say",
}

export type IdentityFields = {
  sex: string
  genderDiffersFromSex: boolean
  genderIdentity: string
  pronouns: string
  pronounsOther: string
  sexualOrientation: SexualOrientation | ""
  sexualOrientationOther: string
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

/** Form labels stay as the client sees them. reportNoun is the noun after "difficulties with". */
export const STRESSOR_ITEMS = [
  { key: "family", label: "Family", reportNoun: "family" },
  { key: "socialLife", label: "Social life", reportNoun: "social life" },
  { key: "intimateRelationships", label: "Intimate relationships", reportNoun: "intimate relationships" },
  { key: "workStudy", label: "Work or study", reportNoun: "work or study" },
  { key: "financial", label: "Financial", reportNoun: "finances" },
  { key: "ownHealth", label: "Your health", reportNoun: "their health" },
  { key: "othersHealth", label: "Health of significant others", reportNoun: "the health of significant others" },
  { key: "lossOfLovedOne", label: "Loss of a loved one", reportNoun: "the loss of a loved one" },
  { key: "legalPoliceAccidents", label: "Legal matters, police or accidents", reportNoun: "legal matters and police or accidents" },
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
  /** Prior partner: free text kept for Other (describe), and for values mapped before howEnded existed. */
  relationshipStatus: string
  /** Prior partner: Separated, Divorced, Partner died, or Other. */
  howEnded: HowEnded | ""
  /** Parent records: Yes, None, or Not asked. */
  laterRelationships: LaterRelationships | ""
  /** Child records. Blank is worth checking. */
  childType: ChildType | ""
  /** Description when child type is Other. */
  childTypeDetail: string
  timeSinceEnded: string
  supportive: RelationshipRating | ""
  conflict: RelationshipRating | ""
  /** Free-text comment under the supportive and conflict ratings. */
  qualityOfRelationship: string
  dependency: DependencyValue | ""
  livingSituation: RelationshipLivingSituation | ""
  /** Caregiver relationship code. Cleared for every other role. */
  caregiverRelationship: string
  /** Description when the caregiver relationship is Other. */
  caregiverRelationshipDetail: string
  /** Partial date. Partner start, or the date care began. */
  startedOn: string
  /** Partial date. Partner end, or the date care ended. */
  endedOn: string
  /** Prior partner relationship type. Cleared for every other role. */
  partnerType: PartnerType | ""
  /** Biological or adoptive. Used on parent records. */
  parentType: ParentType | ""
  /** Partial date an adoptive parent adopted the client. */
  adoptedOn: string
  /** Parent is not known. Other fields stay stored and are hidden. */
  notKnown: boolean
  /** Set when a biological child's other parent is not a recorded partner. */
  otherParentKind: OtherParentKind | ""
  otherParentDetail: string
  linkedPartnerRecordId: string | null
  partnershipRecordId: string | null
  /** Block this person sits in. Empty when they could not be placed. */
  relationshipBlockId?: string | null
  blockRole?: BlockRole | ""
  /** Child type, sibling type, parent side, or caregiver relationship, depending on blockRole. */
  blockRoleType?: string
  /** Set by migration: unlinked_child or unplaced. Cleared when the person is moved. */
  placementReview?: "" | "unlinked_child" | "unplaced"
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
  /** Self, or a significant other. */
  about: HistoryAbout
  /** Who, when the significant other is not a recorded person. */
  aboutOther: string
  familyRelation: string
  familySide: FamilySide | ""
  relationshipRecordId: string | null
  /** Treatment entries: the condition entry this treatment is for. */
  conditionEventId: string | null
  admissionType: AdmissionType | ""
  facility: string
  admissionLength: string
  prescriberProfessionalId: string | null
  /** Free-text supervisor from the old medication record, used when no professional is chosen. */
  prescriberName: string
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
  relationshipBlocks?: RelationshipBlock[]
  blockAnswers?: RelationshipBlockAnswers
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
    sexualOrientation: "",
    sexualOrientationOther: "",
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
    about: eventType === "family_events" ? "significant_other" : "self",
    aboutOther: "",
    familyRelation: "",
    familySide: "",
    relationshipRecordId: null,
    conditionEventId: null,
    admissionType: "",
    facility: "",
    admissionLength: "",
    prescriberProfessionalId: null,
    prescriberName: "",
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
