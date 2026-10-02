import {
  isOneOf,
  RELATIONSHIP_TO_CLIENT,
  type EventRecord,
  type EventType,
  type PartnershipRecord,
  type RelationshipRecord,
  type RelationshipToClient,
} from "@/lib/client-background/types"
import { sanitizeEvent, sanitizePartnership, sanitizeRelationship } from "@/lib/client-background/sanitize"

export function toRelationship(row: {
  relationshipRecordId: string
  relationshipToClient: string
  sex: string | null
  givenName: string | null
  displayOrder: number
  dateOfBirth: string | null
  approximateAge: number | null
  approximateAgeRecordedOn: string | null
  healthStatus: string | null
  deceased: boolean
  ageAtDeath: number | null
  healthOrCauseOfDeath: string | null
  lengthOfRelationship: string | null
  relationshipStatus: string | null
  timeSinceEnded: string | null
  qualityOfRelationship: string | null
  dependency: string | null
  livingSituation: string | null
  linkedPartnerRecordId: string | null
  partnershipRecordId: string | null
}): RelationshipRecord {
  const role: RelationshipToClient = isOneOf(row.relationshipToClient, RELATIONSHIP_TO_CLIENT)
    ? row.relationshipToClient
    : "parent"
  return sanitizeRelationship({
    ...row,
    relationshipToClient: role,
    sex: row.sex ?? "",
    givenName: row.givenName ?? "",
    dateOfBirth: row.dateOfBirth ?? "",
    approximateAge: row.approximateAge,
    approximateAgeRecordedOn: row.approximateAgeRecordedOn ?? "",
    healthOrCauseOfDeath: row.healthOrCauseOfDeath ?? "",
    lengthOfRelationship: row.lengthOfRelationship ?? "",
    relationshipStatus: row.relationshipStatus ?? "",
    timeSinceEnded: row.timeSinceEnded ?? "",
    qualityOfRelationship: row.qualityOfRelationship ?? "",
    dependency: row.dependency ?? "",
    livingSituation: row.livingSituation ?? "",
  })
}

export function toPartnership(row: {
  partnershipRecordId: string
  partnerAId: string
  partnerBId: string
  relationshipStatus: string | null
  started: string | null
  ended: string | null
  qualityOfRelationship: string | null
}): PartnershipRecord {
  return sanitizePartnership({
    ...row,
    relationshipStatus: row.relationshipStatus ?? "",
    started: row.started ?? "",
    ended: row.ended ?? "",
    qualityOfRelationship: row.qualityOfRelationship ?? "",
  })
}

export function toEvent(row: {
  eventRecordId: string
  eventType: string
  title: string | null
  description: string | null
  startPrecision: string | null
  startValue: string | null
  endPrecision: string | null
  endValue: string | null
  endOngoing: boolean
  resolvedOrOngoing: string | null
  treated: boolean | null
  treatmentType: string | null
  treatmentDetail: string | null
  outcome: string | null
  attribution: string
  familyRelation: string | null
  familySide: string | null
  relationshipRecordId: string | null
  selfHarmType: string | null
  substanceStatus: string | null
  abstinentSincePrecision: string | null
  abstinentSinceValue: string | null
  displayOrder: number
}): EventRecord {
  return sanitizeEvent({
    ...row,
    eventType: row.eventType as EventType,
    title: row.title ?? "",
    description: row.description ?? "",
    startPrecision: row.startPrecision ?? "",
    startValue: row.startValue ?? "",
    endPrecision: row.endPrecision ?? "",
    endValue: row.endValue ?? "",
    resolvedOrOngoing: row.resolvedOrOngoing ?? "",
    treatmentType: row.treatmentType ?? "",
    treatmentDetail: row.treatmentDetail ?? "",
    outcome: row.outcome ?? "",
    familyRelation: row.familyRelation ?? "",
    familySide: row.familySide ?? "",
    selfHarmType: row.selfHarmType ?? "",
    substanceStatus: row.substanceStatus ?? "",
    abstinentSincePrecision: row.abstinentSincePrecision ?? "",
    abstinentSinceValue: row.abstinentSinceValue ?? "",
  })
}
