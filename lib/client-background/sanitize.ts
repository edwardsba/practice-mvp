import {
  ATTRIBUTIONS,
  DEPENDENCY_VALUES,
  EVENT_TYPES,
  FAMILY_SIDES,
  isOneOf,
  NECESSITY_KEYS,
  PARTNERSHIP_STATUSES,
  RATED_FACTOR_KEYS,
  RATED_VALUES,
  RELATIONSHIP_TO_CLIENT,
  RESOLVED_OR_ONGOING,
  SELF_HARM_TYPES,
  SEVERITY_IMPACT,
  START_PRECISIONS,
  SUBSTANCE_STATUSES,
  emptyDemographics,
  emptyEducation,
  emptyEvent,
  emptyIdentity,
  emptyLivingSituation,
  emptyNecessities,
  emptyOccupation,
  emptyRisk,
  type Attribution,
  type Demographics,
  type DependencyValue,
  type EducationFields,
  type EventRecord,
  type EventType,
  type FamilySide,
  type IdentityFields,
  type LivingSituationFields,
  type OccupationFields,
  type PartnershipRecord,
  type PartnershipStatus,
  type PreviousJob,
  type RatedValue,
  type RelationshipRecord,
  type RelationshipToClient,
  type ResolvedOrOngoing,
  type RiskRatings,
  type SelfHarmType,
  type SeverityImpact,
  type StartPrecision,
  type SubstanceStatus,
} from "@/lib/client-background/types"
import { applyRelationshipVisibilityDefaults } from "@/lib/client-background/visibility"

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

export function sanitizeIdentity(value: unknown): IdentityFields {
  const raw = isRecord(value) ? value : {}
  const genderDiffersFromSex = bool(raw.genderDiffersFromSex)
  return {
    sex: str(raw.sex),
    genderDiffersFromSex,
    genderIdentity: genderDiffersFromSex ? str(raw.genderIdentity) : "",
    pronouns: str(raw.pronouns),
    pronounsOther: str(raw.pronouns) === "Other" ? str(raw.pronounsOther) : "",
    raceEthnicity: str(raw.raceEthnicity),
    religion: str(raw.religion),
    primaryLanguage: str(raw.primaryLanguage),
    disability: str(raw.disability),
    accessibilityNeeds: str(raw.accessibilityNeeds),
  }
}

export function sanitizeLivingSituation(value: unknown): LivingSituationFields {
  const raw = isRecord(value) ? value : {}
  return {
    housingType: str(raw.housingType),
    householdComposition: str(raw.householdComposition),
    housingStability: str(raw.housingStability),
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
  const job: PreviousJob = {
    id: str(value.id) || crypto.randomUUID(),
    role: str(value.role),
    employer: str(value.employer),
    dates: str(value.dates),
  }
  if (!job.role && !job.employer && !job.dates) return null
  return job
}

export function sanitizeOccupation(value: unknown): OccupationFields {
  const raw = isRecord(value) ? value : {}
  const currentlyEmployed = boolOrNull(raw.currentlyEmployed)
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
    currentlyEmployed,
    currentlyEmployedDetail: currentlyEmployed === true ? str(raw.currentlyEmployedDetail) : "",
    previousJobs: jobs,
    financialConcerns,
    financialConcernsDetail: financialConcerns === true ? str(raw.financialConcernsDetail) : "",
    necessities,
  }
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
}): Demographics {
  const empty = emptyDemographics()
  return {
    identity: parts.identityJson ? sanitizeIdentity(parts.identityJson) : empty.identity,
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

export function sanitizeRelationship(value: unknown, fallbackId = ""): RelationshipRecord {
  const raw = isRecord(value) ? value : {}
  const role = oneOf<RelationshipToClient>(raw.relationshipToClient, RELATIONSHIP_TO_CLIENT)
  const dependency = oneOf<DependencyValue>(raw.dependency, DEPENDENCY_VALUES)
  const age = intOrNull(raw.age)
  const record: RelationshipRecord = {
    relationshipRecordId: str(raw.relationshipRecordId) || fallbackId,
    relationshipToClient: role || "parent",
    gender: str(raw.gender),
    givenName: str(raw.givenName),
    displayOrder: intOrNull(raw.displayOrder) ?? 0,
    age: age != null && age >= 0 && age <= 130 ? age : null,
    deceased: bool(raw.deceased),
    ageAtDeath: bool(raw.deceased) ? intOrNull(raw.ageAtDeath) : null,
    healthOrCauseOfDeath: bool(raw.deceased) ? str(raw.healthOrCauseOfDeath) : "",
    lengthOfRelationship: str(raw.lengthOfRelationship),
    relationshipStatus: str(raw.relationshipStatus),
    timeSinceEnded: str(raw.timeSinceEnded),
    qualityOfRelationship: str(raw.qualityOfRelationship),
    dependency,
    livingSituation: str(raw.livingSituation),
    linkedPartnerRecordId: str(raw.linkedPartnerRecordId) || null,
    partnershipRecordId: str(raw.partnershipRecordId) || null,
  }
  if (!record.deceased) {
    record.ageAtDeath = null
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
    started: str(raw.started),
    ended: str(raw.ended),
    qualityOfRelationship: str(raw.qualityOfRelationship),
  }
}

function sanitizePrecision(value: unknown): StartPrecision | "" {
  return oneOf<StartPrecision>(value, START_PRECISIONS)
}

export function sanitizeEvent(value: unknown, fallbackId = ""): EventRecord {
  const raw = isRecord(value) ? value : {}
  const eventType = oneOf<EventType>(raw.eventType, EVENT_TYPES) || "significant_history"
  const base = emptyEvent(eventType, intOrNull(raw.displayOrder) ?? 0)
  const treated = boolOrNull(raw.treated)
  const endOngoing = bool(raw.endOngoing)
  const attribution: Attribution =
    eventType === "family_events"
      ? "self_linked"
      : oneOf<Attribution>(raw.attribution, ATTRIBUTIONS) === "family"
        ? "family"
        : "self"

  const event: EventRecord = {
    ...base,
    eventRecordId: str(raw.eventRecordId) || fallbackId,
    description: str(raw.description),
    startPrecision: sanitizePrecision(raw.startPrecision),
    startValue: str(raw.startValue),
    endPrecision: endOngoing ? "" : sanitizePrecision(raw.endPrecision),
    endValue: endOngoing ? "" : str(raw.endValue),
    endOngoing,
    resolvedOrOngoing: oneOf<ResolvedOrOngoing>(raw.resolvedOrOngoing, RESOLVED_OR_ONGOING),
    severityImpact: oneOf<SeverityImpact>(raw.severityImpact, SEVERITY_IMPACT),
    treated,
    treatmentType: treated === true ? str(raw.treatmentType) : "",
    treatmentDetail: treated === true ? str(raw.treatmentDetail) : "",
    outcome: treated === true ? str(raw.outcome) : "",
    attribution,
    familyRelation: attribution === "family" ? str(raw.familyRelation) : "",
    familySide: attribution === "family" ? oneOf<FamilySide>(raw.familySide, FAMILY_SIDES) : "",
    relationshipRecordId:
      attribution === "self_linked" ? str(raw.relationshipRecordId) || null : null,
    displayOrder: intOrNull(raw.displayOrder) ?? 0,
  }

  if (eventType === "self_harm") {
    event.selfHarmType = oneOf<SelfHarmType>(raw.selfHarmType, SELF_HARM_TYPES)
    event.substanceInvolvement = boolOrNull(raw.substanceInvolvement)
    event.requiredMedicalAttention = boolOrNull(raw.requiredMedicalAttention)
    event.requiredHospitalisation = boolOrNull(raw.requiredHospitalisation)
  }

  if (eventType === "substance_use") {
    event.substanceStatus = oneOf<SubstanceStatus>(raw.substanceStatus, SUBSTANCE_STATUSES)
    if (event.substanceStatus === "abstinent") {
      event.abstinentSincePrecision = sanitizePrecision(raw.abstinentSincePrecision)
      event.abstinentSinceValue = str(raw.abstinentSinceValue)
    }
  }

  if (!event.startPrecision) event.startValue = ""
  if (!event.endPrecision) event.endValue = ""
  if (!event.abstinentSincePrecision) event.abstinentSinceValue = ""

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
