import { HOW_ENDED, mapHowEnded, type HowEnded } from "@/lib/client-background/how-ended"
import { LATER_RELATIONSHIPS, type LaterRelationships } from "@/lib/client-background/later-relationships"
import {
  ADMISSION_TYPES,
  BLOCK_ROLES,
  CHILD_TYPES,
  HISTORY_ABOUT,
  ATTRIBUTIONS,
  CAREGIVER_RELATIONSHIPS,
  DEPENDENCY_VALUES,
  EVENT_TYPES,
  FAMILY_SIDES,
  HEALTH_STATUSES,
  isOneOf,
  NECESSITY_KEYS,
  OTHER_PARENT_KINDS,
  PARENT_TYPES,
  PARTNER_TYPES,
  PARTNERSHIP_STATUSES,
  RATED_FACTOR_KEYS,
  RATED_VALUES,
  RELATIONSHIP_TO_CLIENT,
  RELATIONSHIP_LIVING_SITUATIONS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RESOLVED_OR_ONGOING,
  SELF_HARM_TYPES,
  SEX_OPTIONS,
  SEXUAL_ORIENTATIONS,
  STRESSOR_ITEMS,
  START_PRECISIONS,
  SUBSTANCE_STATUSES,
  CLIENT_RELATIONSHIP_STATUSES,
  EMPLOYED_WORK_STATUSES,
  HOUSING_TYPE_OPTIONS,
  LIVES_WITH_OPTIONS,
  RELATIONSHIP_RATING_VALUES,
  WORK_STATUSES,
  emptyDemographics,
  emptyEducation,
  emptyEvent,
  emptyIdentity,
  emptyLivingSituation,
  emptyMedication,
  emptyStressors,
  emptyNecessities,
  emptyOccupation,
  emptyRisk,
  type AdmissionType,
  type BlockRole,
  type Attribution,
  type CaregiverRelationship,
  type ClientRelationshipStatus,
  type ClientRelationshipStatusValue,
  type Demographics,
  type DependencyValue,
  type EducationFields,
  type EventRecord,
  type EventType,
  type FamilySide,
  type HealthStatus,
  type IdentityFields,
  type LivesWith,
  type LivingSituationFields,
  type MedicationRecord,
  type OccupationFields,
  type ReasonForAttending,
  type StressorsRecord,
  type TriStateAnswer,
  type WillingnessAnswer,
  type RelationshipRating,
  type WorkStatus,
  type OtherParentKind,
  type ChildType,
  type HistoryAbout,
  type ParentType,
  type PartnerType,
  type PartnershipRecord,
  type PartnershipStatus,
  type PreviousJob,
  type RatedValue,
  type RelationshipRecord,
  type RelationshipToClient,
  type RelationshipLivingSituation,
  type ResolvedOrOngoing,
  type RiskRatings,
  type SelfHarmType,
  type StartPrecision,
  type SubstanceStatus,
} from "@/lib/client-background/types"
import {
  canonicalPartialDate,
  parsePartialDate,
  precisionForPartialDate,
} from "@/lib/client-background/partial-date"
import { applyRelationshipVisibilityDefaults } from "@/lib/client-background/visibility"
import { todayDateString } from "@/lib/dates/practice-time"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function bool(value: unknown): boolean {
  return value === true
}

function boolOrNull(value: unknown): boolean | null {
  if (value === true) return true
  if (value === false) return false
  return null
}

function intOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | "" {
  const text = str(value)
  return isOneOf(text, options) ? text : ""
}

function isoDate(value: unknown): string {
  const text = str(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""
}

function ageOrNull(value: unknown): number | null {
  const age = intOrNull(value)
  return age != null && age >= 0 && age <= 130 ? age : null
}

function normalizeSex(value: unknown): string {
  const text = str(value)
  const match = SEX_OPTIONS.find((option) => option.toLowerCase() === text.toLowerCase())
  return match ?? ""
}

function normalizeLivingSituation(value: unknown): RelationshipLivingSituation | "" {
  const direct = oneOf<RelationshipLivingSituation>(value, RELATIONSHIP_LIVING_SITUATIONS)
  if (direct) return direct
  const text = str(value).toLowerCase()
  if (!text) return ""
  return (
    RELATIONSHIP_LIVING_SITUATIONS.find(
      (option) => RELATIONSHIP_LIVING_SITUATION_LABELS[option].toLowerCase() === text
    ) ?? ""
  )
}

function orientationFrom(raw: Record<string, unknown>): Pick<IdentityFields, "sexualOrientation" | "sexualOrientationOther"> {
  const value = str(raw.sexualOrientation)
  if (!isOneOf(value, SEXUAL_ORIENTATIONS)) return { sexualOrientation: "", sexualOrientationOther: "" }
  return {
    sexualOrientation: value,
    sexualOrientationOther: value === "another" ? str(raw.sexualOrientationOther) : "",
  }
}

function disabilityFrom(raw: Record<string, unknown>): Pick<IdentityFields, "disability" | "disabilityDetail"> {
  if (typeof raw.disability === "string") {
    const text = raw.disability.trim()
    if (text) return { disability: true, disabilityDetail: text }
    return { disability: null, disabilityDetail: "" }
  }
  const disability = boolOrNull(raw.disability)
  return {
    disability,
    disabilityDetail: disability === true ? str(raw.disabilityDetail) : "",
  }
}

export function sanitizeIdentity(value: unknown): IdentityFields {
  const raw = isRecord(value) ? value : {}
  const genderIdentity = str(raw.genderIdentity)
  return {
    sex: str(raw.sex),
    genderDiffersFromSex: genderIdentity.length > 0,
    genderIdentity,
    pronouns: str(raw.pronouns),
    pronounsOther: "",
    ...orientationFrom(raw),
    raceEthnicity: str(raw.raceEthnicity),
    religion: str(raw.religion),
    primaryLanguage: str(raw.primaryLanguage),
    ...disabilityFrom(raw),
    accessibilityNeeds: str(raw.accessibilityNeeds),
  }
}

function housingTypeFrom(raw: Record<string, unknown>): string {
  const stored = str(raw.housingType)
  if (isOneOf(stored, HOUSING_TYPE_OPTIONS)) return stored
  const legacy = str(raw.livingArrangement)
  if (isOneOf(legacy, HOUSING_TYPE_OPTIONS)) return legacy
  return ""
}

export function sanitizeLivingSituation(value: unknown): LivingSituationFields {
  const raw = isRecord(value) ? value : {}
  const livesWith = oneOf<LivesWith>(raw.livesWith, LIVES_WITH_OPTIONS)
  return {
    housingType: housingTypeFrom(raw),
    livesWith,
    livesWithOther: livesWith === "other" ? str(raw.livesWithOther) : "",
    housingStability: str(raw.housingStability),
  }
}

export function sanitizeClientRelationshipStatus(value: unknown): ClientRelationshipStatusValue {
  const raw = isRecord(value) ? value : {}
  const relationshipStatus = oneOf<ClientRelationshipStatus>(raw.relationshipStatus, CLIENT_RELATIONSHIP_STATUSES)
  return {
    relationshipStatus,
    relationshipStatusOther: relationshipStatus === "other" ? str(raw.relationshipStatusOther) : "",
  }
}

export function sanitizeEducation(value: unknown): EducationFields {
  const raw = isRecord(value) ? value : {}
  const currentlyStudying = boolOrNull(raw.currentlyStudying)
  const disruption = boolOrNull(raw.disruption)
  return {
    level: str(raw.level),
    fieldOfStudy: str(raw.fieldOfStudy),
    currentlyStudying,
    currentlyStudyingDetail: currentlyStudying === true ? str(raw.currentlyStudyingDetail) : "",
    disruption,
    disruptionDetail: disruption === true ? str(raw.disruptionDetail) : "",
  }
}

function sanitizeJob(value: unknown): PreviousJob | null {
  if (!isRecord(value)) return null
  const started = canonicalPartialDate(str(value.started)) || canonicalPartialDate(str(value.dates))
  const job: PreviousJob = {
    id: str(value.id) || crypto.randomUUID(),
    role: str(value.role),
    employer: str(value.employer),
    started,
    ended: canonicalPartialDate(str(value.ended)),
  }
  if (!job.role && !job.employer && !job.started && !job.ended) return null
  return job
}

function workStatusFrom(raw: Record<string, unknown>): Pick<
  OccupationFields,
  "workStatus" | "workStatusOther" | "role" | "employer"
> {
  let workStatus = oneOf<WorkStatus>(raw.workStatus, WORK_STATUSES)
  let role = str(raw.role)
  const employer = str(raw.employer)
  if (!workStatus && boolOrNull(raw.currentlyEmployed) === true) {
    workStatus = "full_time"
    if (!role) role = str(raw.currentlyEmployedDetail)
  }
  const employed = workStatus !== "" && (EMPLOYED_WORK_STATUSES as readonly string[]).includes(workStatus)
  return {
    workStatus,
    workStatusOther: workStatus === "other" ? str(raw.workStatusOther) : "",
    role: employed ? role : "",
    employer: employed ? employer : "",
  }
}

export function sanitizeOccupation(value: unknown): OccupationFields {
  const raw = isRecord(value) ? value : {}
  const financialConcerns = boolOrNull(raw.financialConcerns)
  const necessitiesRaw = isRecord(raw.necessities) ? raw.necessities : {}
  const necessities = emptyNecessities()
  for (const key of NECESSITY_KEYS) {
    necessities[key] = bool(necessitiesRaw[key])
  }
  const jobs = Array.isArray(raw.previousJobs)
    ? raw.previousJobs.flatMap((job) => {
        const parsed = sanitizeJob(job)
        return parsed ? [parsed] : []
      })
    : []
  return {
    ...workStatusFrom(raw),
    previousJobs: jobs,
    financialConcerns,
    financialConcernsDetail: financialConcerns === true ? str(raw.financialConcernsDetail) : "",
    necessities,
  }
}

function triState(value: unknown): TriStateAnswer | null {
  return value === "yes" || value === "no" || value === "not_asked" ? value : null
}

function willingness(value: unknown): WillingnessAnswer | null {
  return value === "yes" || value === "somewhat" || value === "no" || value === "not_asked" ? value : null
}

const PROFESSIONAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function professionalId(value: unknown): string | null {
  const text = str(value)
  return PROFESSIONAL_ID.test(text) ? text : null
}

export function sanitizeMedication(value: unknown): MedicationRecord {
  const raw = isRecord(value) ? value : {}
  return {
    currentlyTaking: triState(raw.currentlyTaking),
    previouslyTaken: triState(raw.previouslyTaken),
    supervisedBy: str(raw.supervisedBy),
  }
}

export function sanitizeStressors(value: unknown): StressorsRecord {
  const raw = isRecord(value) ? value : {}
  const stressors = emptyStressors()
  for (const item of STRESSOR_ITEMS) {
    stressors[item.key] = triState(raw[item.key])
  }
  stressors.mainReason = str(raw.mainReason)
  return stressors
}

function referralTypeOf(raw: Record<string, unknown>): ReasonForAttending["referralType"] {
  const explicit = str(raw.referralType)
  if (explicit === "medical" || explicit === "family_or_friend" || explicit === "self") return explicit
  if (triState(raw.referredByMedicalProfessional) === "yes") return "medical"
  if (triState(raw.familyInvolved) === "yes") return "family_or_friend"
  if (triState(raw.ownInitiative) === "yes") return "self"
  return ""
}

export function sanitizeReasonForAttending(value: unknown): ReasonForAttending {
  const raw = isRecord(value) ? value : {}
  const referredByMedicalProfessional = triState(raw.referredByMedicalProfessional)
  const familyInvolved = triState(raw.familyInvolved)
  const referralType = referralTypeOf(raw)
  const medical = referralType === "medical"
  const family = referralType === "family_or_friend"
  const referrerRelationshipId = family ? professionalId(raw.referrerRelationshipId) : null
  const referrerIsOther = family && !referrerRelationshipId && (raw.referrerIsOther === true || str(raw.referrerOther).length > 0)
  return {
    referralType,
    referrerProfessionalId: medical ? professionalId(raw.referrerProfessionalId) : null,
    referralDate: medical ? canonicalPartialDate(str(raw.referralDate)) : "",
    referrerConcerns: medical ? str(raw.referrerConcerns) : "",
    referrerRelationshipId,
    referrerIsOther,
    referrerOther: referrerIsOther ? str(raw.referrerOther) : "",
    theirConcerns: family
      ? str(raw.theirConcerns) || (str(raw.referralType) ? "" : str(raw.familyInvolvement))
      : "",
    referredByMedicalProfessional,
    familyInvolved,
    familyInvolvement: familyInvolved === "yes" ? str(raw.familyInvolvement) : "",
    ownInitiative: triState(raw.ownInitiative),
    attendedWillingly: willingness(raw.attendedWillingly),
    clientMotivation: str(raw.clientMotivation),
  }
}

/** Referral type is one choice, so a blank stays blank. The older Yes/No answers are not filled in. */
export function markUnansweredReason(reason: ReasonForAttending): { reason: ReasonForAttending; changed: boolean } {
  return { reason, changed: false }
}

export function markUnansweredMedicationAndStressors(
  medication: MedicationRecord,
  stressors: StressorsRecord
): { medication: MedicationRecord; stressors: StressorsRecord; changed: boolean } {
  let changed = false
  const nextMedication = { ...medication }
  const nextStressors = { ...stressors }
  for (const item of STRESSOR_ITEMS) {
    if (nextStressors[item.key] == null) {
      nextStressors[item.key] = "not_asked"
      changed = true
    }
  }
  return { medication: nextMedication, stressors: nextStressors, changed }
}

export function sanitizeDemographics(value: unknown): Demographics {
  const raw = isRecord(value) ? value : {}
  return {
    identity: sanitizeIdentity(raw.identity),
    livingSituation: sanitizeLivingSituation(raw.livingSituation),
    education: sanitizeEducation(raw.education),
    occupation: sanitizeOccupation(raw.occupation),
  }
}

export function demographicsFromStored(parts: {
  identityJson: unknown
  livingSituationJson: unknown
  educationJson: unknown
  occupationJson: unknown
  sexualOrientation?: string | null
  sexualOrientationOther?: string | null
}): Demographics {
  const empty = emptyDemographics()
  const identity = parts.identityJson ? sanitizeIdentity(parts.identityJson) : empty.identity
  const stored = orientationFrom({
    sexualOrientation: parts.sexualOrientation ?? identity.sexualOrientation,
    sexualOrientationOther: parts.sexualOrientationOther ?? identity.sexualOrientationOther,
  })
  if (parts.sexualOrientation) {
    identity.sexualOrientation = stored.sexualOrientation
    identity.sexualOrientationOther = stored.sexualOrientationOther
  }
  return {
    identity,
    livingSituation: parts.livingSituationJson
      ? sanitizeLivingSituation(parts.livingSituationJson)
      : empty.livingSituation,
    education: parts.educationJson ? sanitizeEducation(parts.educationJson) : empty.education,
    occupation: parts.occupationJson ? sanitizeOccupation(parts.occupationJson) : empty.occupation,
  }
}

export function sanitizeRisk(value: unknown): RiskRatings {
  const raw = isRecord(value) ? value : {}
  const risk = emptyRisk()
  for (const key of RATED_FACTOR_KEYS) {
    const item = isRecord(raw[key]) ? raw[key] : {}
    const rated = oneOf<RatedValue>(item.value, RATED_VALUES)
    risk[key] = {
      value: rated,
      comment: str(item.comment),
    }
  }
  return risk
}

/** Maps a stored caregiver relationship onto the dropdown. Unknown text becomes Other and is kept. */
export function normalizeCaregiverRelationship(
  kind: string,
  detail: string
): { kind: CaregiverRelationship | ""; detail: string } {
  const trimmed = kind.trim()
  if (!trimmed) return { kind: "", detail: "" }
  if (isOneOf(trimmed, CAREGIVER_RELATIONSHIPS)) {
    const specific = detail.trim()
    const keepGrandparent =
      trimmed === "grandparent" && specific.length > 0 && !/^grandparent$/i.test(specific)
    return { kind: trimmed, detail: trimmed === "other" || keepGrandparent ? specific : "" }
  }
  const value = trimmed.toLowerCase()
  if (/grandparent|grandmother|grandfather|grandma|grandpa|nanna|\bnan\b|\bpop\b/.test(value)) {
    const specific = detail.trim() || (value === "grandparent" ? "" : trimmed)
    const keep = /maternal|paternal|grandmother|grandfather/.test(specific.toLowerCase()) ? specific : ""
    return { kind: "grandparent", detail: keep }
  }
  if (value.includes("foster")) return { kind: "foster_carer", detail: "" }
  if (value.includes("kinship")) return { kind: "kinship_carer", detail: "" }
  if (/residential|out[- ]of[- ]home|\boohc\b/.test(value)) return { kind: "residential", detail: "" }
  if (/family friend|\bfriend\b/.test(value)) return { kind: "family_friend", detail: "" }
  if (/relative|aunt|uncle|cousin/.test(value)) return { kind: "other_relative", detail: "" }
  return { kind: "other", detail: detail.trim() || trimmed }
}

export function sanitizeRelationship(value: unknown, fallbackId = ""): RelationshipRecord {
  const raw = isRecord(value) ? value : {}
  const role = oneOf<RelationshipToClient>(raw.relationshipToClient, RELATIONSHIP_TO_CLIENT)
  const dependency = oneOf<DependencyValue>(raw.dependency, DEPENDENCY_VALUES)
  let dateOfBirth = canonicalPartialDate(str(raw.dateOfBirth))
  if (!dateOfBirth) {
    let approximateAge = ageOrNull(raw.approximateAge)
    let recordedOn = isoDate(raw.approximateAgeRecordedOn)
    if (approximateAge == null) {
      const legacyAge = ageOrNull(raw.age)
      if (legacyAge != null) {
        approximateAge = legacyAge
        recordedOn = recordedOn || todayDateString()
      }
    }
    if (approximateAge != null) {
      const recordedYear = parsePartialDate(recordedOn || todayDateString()).year
      if (recordedYear != null) {
        const year = recordedYear - approximateAge
        if (year >= 1 && year <= 9999) dateOfBirth = String(year)
      }
    }
  }
  const explicitHealth = oneOf<HealthStatus>(raw.healthStatus, HEALTH_STATUSES)
  const healthStatus = explicitHealth || (bool(raw.deceased) ? "deceased" : "")
  const deceased = healthStatus === "deceased"
  const record: RelationshipRecord = {
    relationshipRecordId: str(raw.relationshipRecordId) || fallbackId,
    relationshipToClient: role || "parent",
    sex: normalizeSex(raw.sex) || normalizeSex(raw.gender),
    givenName: str(raw.givenName),
    displayOrder: intOrNull(raw.displayOrder) ?? 0,
    dateOfBirth,
    approximateAge: null,
    approximateAgeRecordedOn: "",
    healthStatus,
    deceased,
    ageAtDeath: deceased ? intOrNull(raw.ageAtDeath) : null,
    dateOfDeath: deceased ? canonicalPartialDate(str(raw.dateOfDeath)) : "",
    healthOrCauseOfDeath: deceased ? str(raw.healthOrCauseOfDeath) : "",
    lengthOfRelationship: str(raw.lengthOfRelationship),
    relationshipStatus: str(raw.relationshipStatus),
    howEnded: oneOf<HowEnded>(raw.howEnded, HOW_ENDED),
    laterRelationships: oneOf<LaterRelationships>(raw.laterRelationships, LATER_RELATIONSHIPS),
    childType: oneOf<ChildType>(raw.childType, CHILD_TYPES),
    childTypeDetail: str(raw.childTypeDetail),
    timeSinceEnded: str(raw.timeSinceEnded),
    supportive: oneOf<RelationshipRating>(raw.supportive, RELATIONSHIP_RATING_VALUES),
    conflict: oneOf<RelationshipRating>(raw.conflict, RELATIONSHIP_RATING_VALUES),
    qualityOfRelationship: str(raw.qualityOfRelationship),
    dependency,
    livingSituation: normalizeLivingSituation(raw.livingSituation),
    caregiverRelationship: str(raw.caregiverRelationship),
    caregiverRelationshipDetail: str(raw.caregiverRelationshipDetail),
    startedOn: canonicalPartialDate(str(raw.startedOn)),
    endedOn: canonicalPartialDate(str(raw.endedOn)),
    partnerType: oneOf<PartnerType>(raw.partnerType, PARTNER_TYPES),
    parentType: oneOf<ParentType>(raw.parentType, PARENT_TYPES),
    adoptedOn: canonicalPartialDate(str(raw.adoptedOn)),
    notKnown: bool(raw.notKnown),
    otherParentKind: oneOf<OtherParentKind>(raw.otherParentKind, OTHER_PARENT_KINDS),
    otherParentDetail: str(raw.otherParentDetail),
    linkedPartnerRecordId: str(raw.linkedPartnerRecordId) || null,
    partnershipRecordId: str(raw.partnershipRecordId) || null,
    relationshipBlockId: str(raw.relationshipBlockId) || null,
    blockRole: oneOf<BlockRole>(raw.blockRole, BLOCK_ROLES),
    blockRoleType: str(raw.blockRoleType),
    placementReview:
      raw.placementReview === "unlinked_child" || raw.placementReview === "unplaced" ? raw.placementReview : "",
  }
  if (!record.howEnded && record.relationshipStatus) {
    const mapped = mapHowEnded(record.relationshipStatus)
    record.howEnded = mapped.howEnded
  }
  const caregiver = normalizeCaregiverRelationship(record.caregiverRelationship, record.caregiverRelationshipDetail)
  record.caregiverRelationship = caregiver.kind
  record.caregiverRelationshipDetail = caregiver.detail
  if (!record.deceased) {
    record.ageAtDeath = null
    record.dateOfDeath = ""
    record.healthOrCauseOfDeath = ""
  }
  return applyRelationshipVisibilityDefaults(record)
}

export function sanitizePartnership(value: unknown, fallbackId = ""): PartnershipRecord {
  const raw = isRecord(value) ? value : {}
  return {
    partnershipRecordId: str(raw.partnershipRecordId) || fallbackId,
    partnerAId: str(raw.partnerAId),
    partnerBId: str(raw.partnerBId),
    relationshipStatus: oneOf<PartnershipStatus>(raw.relationshipStatus, PARTNERSHIP_STATUSES),
    started: canonicalPartialDate(str(raw.started)),
    ended: canonicalPartialDate(str(raw.ended)),
    qualityOfRelationship: str(raw.qualityOfRelationship),
  }
}

function sanitizePrecision(value: unknown): StartPrecision | "" {
  return oneOf<StartPrecision>(value, START_PRECISIONS)
}

function normalizePartialBoundary(
  precision: StartPrecision | "",
  value: string
): { precision: StartPrecision | ""; value: string } {
  if (!precision) return { precision: "", value: "" }
  if (precision === "age") {
    const trimmed = value.trim()
    if (!/^\d{1,3}$/.test(trimmed)) return { precision: "", value: "" }
    const age = Number(trimmed)
    if (age > 130) return { precision: "", value: "" }
    return { precision: "age", value: String(age) }
  }
  const formatted = canonicalPartialDate(value)
  return { precision: precisionForPartialDate(parsePartialDate(formatted)), value: formatted }
}

export function sanitizeEvent(value: unknown, fallbackId = ""): EventRecord {
  const raw = isRecord(value) ? value : {}
  const eventType = oneOf<EventType>(raw.eventType, EVENT_TYPES) || "significant_history"
  const base = emptyEvent(eventType, intOrNull(raw.displayOrder) ?? 0)
  const treated = boolOrNull(raw.treated)
  let resolvedOrOngoing = oneOf<ResolvedOrOngoing>(raw.resolvedOrOngoing, RESOLVED_OR_ONGOING)
  if (!resolvedOrOngoing && bool(raw.endOngoing)) resolvedOrOngoing = "ongoing"
  const ongoing = resolvedOrOngoing === "ongoing"
  const storedAttribution = oneOf<Attribution>(raw.attribution, ATTRIBUTIONS)
  const legacyOther = storedAttribution === "family" || storedAttribution === "self_linked" || eventType === "family_events"
  const about: HistoryAbout =
    oneOf<HistoryAbout>(raw.about, HISTORY_ABOUT) === "significant_other" || legacyOther
      ? "significant_other"
      : "self"
  const relationshipRecordId = about === "significant_other" ? str(raw.relationshipRecordId) || null : null
  const aboutOther =
    about === "significant_other" && !relationshipRecordId
      ? str(raw.aboutOther) || str(raw.familyRelation)
      : ""
  const attribution: Attribution =
    about === "self" ? "self" : relationshipRecordId ? "self_linked" : "family"

  const event: EventRecord = {
    ...base,
    eventRecordId: str(raw.eventRecordId) || fallbackId,
    title: str(raw.title),
    description: str(raw.description),
    startPrecision: sanitizePrecision(raw.startPrecision),
    startValue: str(raw.startValue),
    endPrecision: ongoing ? "" : sanitizePrecision(raw.endPrecision),
    endValue: ongoing ? "" : str(raw.endValue),
    endOngoing: ongoing,
    resolvedOrOngoing,
    treated,
    treatmentType: treated === true ? str(raw.treatmentType) : "",
    treatmentDetail: treated === true ? str(raw.treatmentDetail) : "",
    outcome: treated === true ? str(raw.outcome) : "",
    attribution,
    about,
    aboutOther,
    familyRelation: attribution === "family" ? str(raw.familyRelation) || aboutOther : "",
    familySide: attribution === "family" ? oneOf<FamilySide>(raw.familySide, FAMILY_SIDES) : "",
    relationshipRecordId,
    conditionEventId: str(raw.conditionEventId) || null,
    conditionGroupId: str(raw.conditionGroupId) || null,
    admissionType: oneOf<AdmissionType>(raw.admissionType, ADMISSION_TYPES),
    facility: str(raw.facility),
    admissionLength: str(raw.admissionLength),
    prescriberProfessionalId: professionalId(raw.prescriberProfessionalId),
    prescriberName: str(raw.prescriberName),
    displayOrder: intOrNull(raw.displayOrder) ?? 0,
  }

  const treatment =
    eventType === "psychiatric_admission" || eventType === "previous_therapy" || eventType === "medication"
  if (!treatment) event.conditionEventId = null
  const condition =
    eventType === "emotional_problems" || eventType === "substance_use" || eventType === "illness_injury"
  if (!condition || (event.conditionGroupId ?? "").startsWith("title:")) event.conditionGroupId = null
  if (eventType !== "psychiatric_admission") {
    event.admissionType = ""
    event.facility = ""
    event.admissionLength = ""
  }
  if (eventType !== "medication") {
    event.prescriberProfessionalId = null
    event.prescriberName = ""
  } else if (event.prescriberProfessionalId) {
    event.prescriberName = ""
  }

  if (eventType === "self_harm") {
    event.selfHarmType = oneOf<SelfHarmType>(raw.selfHarmType, SELF_HARM_TYPES)
  }

  if (eventType === "substance_use") {
    event.substanceStatus = oneOf<SubstanceStatus>(raw.substanceStatus, SUBSTANCE_STATUSES)
    if (event.substanceStatus === "abstinent") {
      event.abstinentSincePrecision = sanitizePrecision(raw.abstinentSincePrecision)
      event.abstinentSinceValue = str(raw.abstinentSinceValue)
    }
  }

  const start = normalizePartialBoundary(event.startPrecision, event.startValue)
  event.startPrecision = start.precision
  event.startValue = start.value
  const end = normalizePartialBoundary(event.endPrecision, event.endValue)
  event.endPrecision = end.precision
  event.endValue = end.value
  const abstinent = normalizePartialBoundary(event.abstinentSincePrecision, event.abstinentSinceValue)
  event.abstinentSincePrecision = abstinent.precision === "age" ? "" : abstinent.precision
  event.abstinentSinceValue = abstinent.precision === "age" ? "" : abstinent.value

  return event
}

export function emptyStoredDemographics(): {
  identity: IdentityFields
  living: LivingSituationFields
  education: EducationFields
  occupation: OccupationFields
} {
  return {
    identity: emptyIdentity(),
    living: emptyLivingSituation(),
    education: emptyEducation(),
    occupation: emptyOccupation(),
  }
}
