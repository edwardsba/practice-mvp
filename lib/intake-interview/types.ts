export const INTAKE_INTERVIEW_STATUSES = ["draft", "finalised"] as const
export type IntakeInterviewStatus = (typeof INTAKE_INTERVIEW_STATUSES)[number]

export const RELATIONSHIP_TO_CLIENT = [
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

export const RELATIONSHIP_SECTIONS = [
  "family_of_origin",
  "partners_and_children",
] as const
export type RelationshipSection = (typeof RELATIONSHIP_SECTIONS)[number]

export const DEPENDENCY_VALUES = [
  "neither",
  "they_depend_on_me",
  "i_depend_on_them",
  "mutual",
] as const
export type DependencyValue = (typeof DEPENDENCY_VALUES)[number]

export const EVENT_CATEGORIES = ["childhood", "adulthood", "family"] as const
export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export const EVENT_SUB_DOMAINS = [
  "major_events",
  "illness_injury",
  "emotional_problems",
  "psychiatric_treatment",
  "history_of_abuse",
  "drugs_or_alcohol",
] as const
export type EventSubDomain = (typeof EVENT_SUB_DOMAINS)[number]

export const CHILDHOOD_SUB_DOMAINS: EventSubDomain[] = [
  "major_events",
  "illness_injury",
  "emotional_problems",
  "psychiatric_treatment",
  "history_of_abuse",
]

export const ADULTHOOD_SUB_DOMAINS: EventSubDomain[] = [
  "major_events",
  "illness_injury",
  "emotional_problems",
  "psychiatric_treatment",
  "history_of_abuse",
  "drugs_or_alcohol",
]

export const FAMILY_HISTORY_SUB_DOMAINS = ADULTHOOD_SUB_DOMAINS

export const PARENTS_MARITAL_STATUSES = [
  "together",
  "separated",
  "divorced",
  "remarried",
  "widowed",
  "other",
] as const
export type ParentsMaritalStatus = (typeof PARENTS_MARITAL_STATUSES)[number]

export const CLIENT_BIRTH_ORDERS = [
  "eldest",
  "middle",
  "youngest",
  "only",
  "other",
] as const
export type ClientBirthOrder = (typeof CLIENT_BIRTH_ORDERS)[number]

export const RESOLVED_OR_ONGOING = ["ongoing", "resolved"] as const
export type ResolvedOrOngoing = (typeof RESOLVED_OR_ONGOING)[number]

export type FamilyOfOriginRosterInput = {
  parentsMaritalStatus: ParentsMaritalStatus | ""
  parentsMaritalStatusOther: string
  parentCount: number | null
  stepParentCount: number | null
  fullSiblingCount: number | null
  halfSiblingCount: number | null
  stepSiblingCount: number | null
  clientBirthOrder: ClientBirthOrder | ""
}

export type PartnerChildrenCounts = {
  biological: number | null
  step: number | null
}

export type PartnersChildrenRosterInput = {
  currentPartnerCount: number | null
  priorPartnerCount: number | null
  unlinkedChildCount: number | null
  childrenByPartnerId: Record<string, PartnerChildrenCounts>
}

export type RelationshipRecord = {
  relationshipRecordId: string
  section: RelationshipSection
  rosterKey: string
  displayOrder: number
  relationshipToClient: RelationshipToClient
  givenName: string
  linkedPartnerRecordId: string | null
  age: number | null
  deceased: boolean
  ageAtDeath: number | null
  healthOrCauseOfDeath: string
  lengthOfRelationship: string
  relationshipStatus: string
  timeSinceEnded: string
  qualityOfRelationship: string
  dependency: DependencyValue | ""
  livingSituation: string
}

export type EventRecord = {
  eventRecordId: string
  eventCategory: EventCategory
  subDomain: EventSubDomain
  personKind: "self" | "relationship"
  relationshipRecordId: string | null
  endorsed: boolean
  reasonDescription: string
  ageDateStart: string
  ageDateEnd: string
  resolvedOrOngoing: ResolvedOrOngoing | ""
  severityImpact: string
  treated: boolean | null
  treatmentType: string
  treatmentDetail: string
  outcome: string
  displayOrder: number
}

export type IdentityFields = {
  sex: string
  genderDiffersFromSex: boolean
  genderIdentity: string
  pronouns: string
  race: string
  ethnicity: string
  culturalReligiousBackground: string
  primaryLanguage: string
  interpreterNeeded: boolean
  interpreterNeeds: string
  disability: string
  accessibilityNeeds: string
}

export type LivingSituationFields = {
  householdComposition: string
  housingType: string
  housingStability: string
}

export type EducationalEvent = {
  id: string
  description: string
  ageDateStart: string
  completed: boolean | null
  detail: string
}

export type EducationFields = {
  level: string
  fieldOfStudy: string
  currentlyStudying: boolean | null
  currentlyStudyingDetail: string
  disruption: boolean | null
  disruptionDetail: string
  showEducationalEventHistory: boolean
  educationalEvents: EducationalEvent[]
}

export type OccupationJob = {
  id: string
  title: string
  employer: string
  startYear: string
  endYear: string
  issues: string
}

export type OccupationFields = {
  currentJob: OccupationJob
  previousJobs: OccupationJob[]
}

export type NecessityAccess = {
  hasDifficulty: boolean
  detail: string
}

export type FinancialFields = {
  financialConcerns: string
  food: NecessityAccess
  prescriptions: NecessityAccess
  transport: NecessityAccess
  leisure: NecessityAccess
  phoneInternet: NecessityAccess
}

export type FamilySupportFields = {
  hasSupport: boolean | null
  quality: string
  detail: string
}

export type PetsFields = {
  petCount: number | null
  types: string
  significance: string
}

export type FriendshipsFields = {
  hasCloseFriends: boolean | null
  approximateCount: number | null
  quality: string
  detail: string
}

export type ReligiousEngagementFields = {
  engaged: boolean | null
  tradition: string
  detail: string
  suicideProtectiveBelief: boolean | null
  suicideProtectiveBeliefDetail: string
}

export type GroupMembership = {
  id: string
  name: string
  detail: string
}

export type SocialSupportFields = {
  familySupport: FamilySupportFields
  pets: PetsFields
  friendships: FriendshipsFields
  religiousEngagement: ReligiousEngagementFields
  groups: GroupMembership[]
}

export type FamilyHistoryFields = {
  selectedRelationshipIds: string[]
}

export type IntakeInterviewPayload = {
  interviewDate: string
  identity: IdentityFields
  familyOfOriginRoster: FamilyOfOriginRosterInput
  partnersChildrenRoster: PartnersChildrenRosterInput
  familyHistory: FamilyHistoryFields
  relationships: RelationshipRecord[]
  events: EventRecord[]
  livingSituation: LivingSituationFields
  education: EducationFields
  occupation: OccupationFields
  financial: FinancialFields
  socialSupport: SocialSupportFields
}

export type IntakeInterviewRow = {
  intakeInterviewId: string
  clientId: string
  practiceId: string
  practitionerProfileId: string
  interviewDate: string | null
  status: IntakeInterviewStatus
  versionNumber: number
  isCurrentVersion: boolean
  previousVersionId: string | null
  isActive: boolean
  familyOfOriginSummary: string | null
  partnersChildrenSummary: string | null
  finalisedAt: Date | null
  createdAt: Date
  updatedAt: Date
  payload: IntakeInterviewPayload
}

export type RosterSlot = {
  rosterKey: string
  section: RelationshipSection
  relationshipToClient: RelationshipToClient
  linkedPartnerRosterKey: string | null
  label: string
}
