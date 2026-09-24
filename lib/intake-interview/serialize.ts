import type {
  EducationFields,
  EventRecord,
  FamilyHistoryFields,
  FamilyOfOriginRosterInput,
  FinancialFields,
  IdentityFields,
  IntakeInterviewPayload,
  IntakeInterviewRow,
  IntakeInterviewStatus,
  LivingSituationFields,
  OccupationFields,
  PartnersChildrenRosterInput,
  RelationshipRecord,
  SocialSupportFields,
} from "@/lib/intake-interview/types"
import { emptyPayload } from "@/lib/intake-interview/defaults"
import { INTAKE_INTERVIEW_STATUSES } from "@/lib/intake-interview/types"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asStatus(value: string): IntakeInterviewStatus {
  return INTAKE_INTERVIEW_STATUSES.includes(value as IntakeInterviewStatus)
    ? (value as IntakeInterviewStatus)
    : "draft"
}

export function payloadFromStoredJson(params: {
  interviewDate: string | null
  identityJson: unknown
  familyOfOriginRosterJson: unknown
  partnersChildrenRosterJson: unknown
  familyHistoryJson: unknown
  livingSituationJson: unknown
  educationJson: unknown
  occupationJson: unknown
  financialSituationJson: unknown
  socialSupportJson: unknown
  relationships: RelationshipRecord[]
  events: EventRecord[]
}): IntakeInterviewPayload {
  const base = emptyPayload(params.interviewDate ?? "")
  return {
    interviewDate: params.interviewDate ?? "",
    identity: {
      ...base.identity,
      ...(isObject(params.identityJson) ? (params.identityJson as IdentityFields) : {}),
    },
    familyOfOriginRoster: {
      ...base.familyOfOriginRoster,
      ...(isObject(params.familyOfOriginRosterJson)
        ? (params.familyOfOriginRosterJson as FamilyOfOriginRosterInput)
        : {}),
    },
    partnersChildrenRoster: {
      ...base.partnersChildrenRoster,
      ...(isObject(params.partnersChildrenRosterJson)
        ? (params.partnersChildrenRosterJson as PartnersChildrenRosterInput)
        : {}),
      childrenByPartnerId: {
        ...base.partnersChildrenRoster.childrenByPartnerId,
        ...(isObject(params.partnersChildrenRosterJson) &&
        isObject(
          (params.partnersChildrenRosterJson as PartnersChildrenRosterInput)
            .childrenByPartnerId
        )
          ? (params.partnersChildrenRosterJson as PartnersChildrenRosterInput)
              .childrenByPartnerId
          : {}),
      },
    },
    familyHistory: {
      ...base.familyHistory,
      ...(isObject(params.familyHistoryJson)
        ? (params.familyHistoryJson as FamilyHistoryFields)
        : {}),
    },
    relationships: params.relationships,
    events: params.events,
    livingSituation: {
      ...base.livingSituation,
      ...(isObject(params.livingSituationJson)
        ? (params.livingSituationJson as LivingSituationFields)
        : {}),
    },
    education: {
      ...base.education,
      ...(isObject(params.educationJson)
        ? (params.educationJson as EducationFields)
        : {}),
    },
    occupation: {
      ...base.occupation,
      ...(isObject(params.occupationJson)
        ? (params.occupationJson as OccupationFields)
        : {}),
    },
    financial: {
      ...base.financial,
      ...(isObject(params.financialSituationJson)
        ? (params.financialSituationJson as FinancialFields)
        : {}),
    },
    socialSupport: {
      ...base.socialSupport,
      ...(isObject(params.socialSupportJson)
        ? (params.socialSupportJson as SocialSupportFields)
        : {}),
    },
  }
}

export function toStoredRelationship(record: RelationshipRecord) {
  return {
    relationshipRecordId: record.relationshipRecordId,
    section: record.section,
    rosterKey: record.rosterKey,
    displayOrder: record.displayOrder,
    relationshipToClient: record.relationshipToClient,
    givenName: record.givenName.trim() || null,
    linkedPartnerRecordId: record.linkedPartnerRecordId,
    age: record.age,
    deceased: record.deceased,
    ageAtDeath: record.deceased ? record.ageAtDeath : null,
    healthOrCauseOfDeath: record.deceased
      ? record.healthOrCauseOfDeath.trim() || null
      : null,
    lengthOfRelationship: record.lengthOfRelationship.trim() || null,
    relationshipStatus: record.relationshipStatus.trim() || null,
    timeSinceEnded: record.timeSinceEnded.trim() || null,
    qualityOfRelationship: record.qualityOfRelationship.trim() || null,
    dependency: record.dependency || null,
    livingSituation: record.livingSituation.trim() || null,
  }
}

export function fromStoredRelationship(row: {
  relationshipRecordId: string
  section: string
  rosterKey: string
  displayOrder: number
  relationshipToClient: string
  givenName: string | null
  linkedPartnerRecordId: string | null
  age: number | null
  deceased: boolean
  ageAtDeath: number | null
  healthOrCauseOfDeath: string | null
  lengthOfRelationship: string | null
  relationshipStatus: string | null
  timeSinceEnded: string | null
  qualityOfRelationship: string | null
  dependency: string | null
  livingSituation: string | null
}): RelationshipRecord {
  return {
    relationshipRecordId: row.relationshipRecordId,
    section: row.section as RelationshipRecord["section"],
    rosterKey: row.rosterKey,
    displayOrder: row.displayOrder,
    relationshipToClient:
      row.relationshipToClient as RelationshipRecord["relationshipToClient"],
    givenName: row.givenName ?? "",
    linkedPartnerRecordId: row.linkedPartnerRecordId,
    age: row.age,
    deceased: row.deceased,
    ageAtDeath: row.ageAtDeath,
    healthOrCauseOfDeath: row.healthOrCauseOfDeath ?? "",
    lengthOfRelationship: row.lengthOfRelationship ?? "",
    relationshipStatus: row.relationshipStatus ?? "",
    timeSinceEnded: row.timeSinceEnded ?? "",
    qualityOfRelationship: row.qualityOfRelationship ?? "",
    dependency: (row.dependency ?? "") as RelationshipRecord["dependency"],
    livingSituation: row.livingSituation ?? "",
  }
}

export function toStoredEvent(event: EventRecord) {
  return {
    eventRecordId: event.eventRecordId,
    eventCategory: event.eventCategory,
    subDomain: event.subDomain,
    personKind: event.personKind,
    relationshipRecordId: event.relationshipRecordId,
    endorsed: event.endorsed,
    reasonDescription: event.reasonDescription.trim() || null,
    ageDateStart: event.ageDateStart.trim() || null,
    ageDateEnd: event.ageDateEnd.trim() || null,
    resolvedOrOngoing: event.resolvedOrOngoing || null,
    severityImpact: event.severityImpact.trim() || null,
    treated: event.treated,
    treatmentType: event.treatmentType.trim() || null,
    treatmentDetail: event.treatmentDetail.trim() || null,
    outcome: event.outcome.trim() || null,
    displayOrder: event.displayOrder,
  }
}

export function fromStoredEvent(row: {
  eventRecordId: string
  eventCategory: string
  subDomain: string
  personKind: string
  relationshipRecordId: string | null
  endorsed: boolean
  reasonDescription: string | null
  ageDateStart: string | null
  ageDateEnd: string | null
  resolvedOrOngoing: string | null
  severityImpact: string | null
  treated: boolean | null
  treatmentType: string | null
  treatmentDetail: string | null
  outcome: string | null
  displayOrder: number
}): EventRecord {
  return {
    eventRecordId: row.eventRecordId,
    eventCategory: row.eventCategory as EventRecord["eventCategory"],
    subDomain: row.subDomain as EventRecord["subDomain"],
    personKind: row.personKind as EventRecord["personKind"],
    relationshipRecordId: row.relationshipRecordId,
    endorsed: row.endorsed,
    reasonDescription: row.reasonDescription ?? "",
    ageDateStart: row.ageDateStart ?? "",
    ageDateEnd: row.ageDateEnd ?? "",
    resolvedOrOngoing: (row.resolvedOrOngoing ?? "") as EventRecord["resolvedOrOngoing"],
    severityImpact: row.severityImpact ?? "",
    treated: row.treated,
    treatmentType: row.treatmentType ?? "",
    treatmentDetail: row.treatmentDetail ?? "",
    outcome: row.outcome ?? "",
    displayOrder: row.displayOrder,
  }
}

export function toInterviewRow(params: {
  intakeInterviewId: string
  clientId: string
  practiceId: string
  practitionerProfileId: string
  interviewDate: string | null
  status: string
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
}): IntakeInterviewRow {
  return {
    ...params,
    status: asStatus(params.status),
  }
}
