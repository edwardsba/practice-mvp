import {
  ATTRIBUTIONS,
  DEPENDENCY_VALUES,
  EVENT_TYPES,
  FAMILY_SIDES,
  HEALTH_STATUSES,
  isOneOf,
  NECESSITY_KEYS,
  PARTNERSHIP_STATUSES,
  RATED_FACTOR_KEYS,
  RATED_VALUES,
  RELATIONSHIP_TO_CLIENT,
  RELATIONSHIP_LIVING_SITUATIONS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RESOLVED_OR_ONGOING,
  SELF_HARM_TYPES,
  SEX_OPTIONS,
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
  type HealthStatus,
  type IdentityFields,
  type LivingSituationFields,
  type OccupationFields,
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

export function sanitizeIdentity(value: unknown): IdentityFields {
  const raw = isRecord(value) ? value : {}
  const genderIdentity = str(raw.genderIdentity)
  return {
    sex: str(raw.sex),
    genderDiffersFromSex: genderIdentity.length > 0,
    genderIdentity,
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
  const clientDependsOnOthers = boolOrNull(raw.clientDependsOnOthers)
  const othersDependOnClient = boolOrNull(raw.othersDependOnClient)
  return {
    livingArrangement: str(raw.livingArrangement) || str(raw.housingType),
    clientDependsOnOthers,
    clientDependsOnOthersDetail:
      clientDependsOnOthers === true ? str(raw.clientDependsOnOthersDetail) : "",
    othersDependOnClient,
    othersDependOnClientDetail: othersDependOnClient === true ? str(raw.othersDependOnClientDetail) : "",
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
    dates: canonicalPartialDate(str(value.dates)),
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
    healthOrCauseOfDeath: deceased ? str(raw.healthOrCauseOfDeath) : "",
    lengthOfRelationship: str(raw.lengthOfRelationship),
    relationshipStatus: str(raw.relationshipStatus),
    timeSinceEnded: str(raw.timeSinceEnded),
    qualityOfRelationship: str(raw.qualityOfRelationship),
    dependency,
    livingSituation: normalizeLivingSituation(raw.livingSituation),
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
  const attribution: Attribution =
    eventType === "family_events"
      ? "self_linked"
      : oneOf<Attribution>(raw.attribution, ATTRIBUTIONS) === "family"
        ? "family"
        : "self"

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
    familyRelation: attribution === "family" ? str(raw.familyRelation) : "",
    familySide: attribution === "family" ? oneOf<FamilySide>(raw.familySide, FAMILY_SIDES) : "",
    relationshipRecordId:
      attribution === "self_linked" ? str(raw.relationshipRecordId) || null : null,
    displayOrder: intOrNull(raw.displayOrder) ?? 0,
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
