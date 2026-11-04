import { assessAge } from "@/lib/client-background/age"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import type { RelationshipRecord, RelationshipToClient } from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"

export type RelationshipFieldVisibility = {
  dateOfBirth: boolean
  laterRelationships: boolean
  childType: boolean
  health: boolean
  lengthOfRelationship: boolean
  supportive: boolean
  comment: boolean
  dependency: boolean
  livingSituation: boolean
  clientRelationshipStatus: boolean
  howItEnded: boolean
  timeSinceEnded: boolean
  /** Partner start and end, or the dates a caregiver cared for the client. */
  spanDates: boolean
  partnerType: boolean
  parentType: boolean
  adoptedOn: boolean
  notKnown: boolean
}

const LENGTH_OF_RELATIONSHIP_ROLES = new Set<RelationshipToClient>([
  "step_parent",
  "sibling_step",
  "child_step",
])

const SPAN_DATE_ROLES = new Set<RelationshipToClient>([
  "current_partner",
  "prior_partner",
  "other_caregiver",
])

const PARENT_ROLES = new Set<RelationshipToClient>(["mother", "father", "parent"])

type AgeSource = Pick<RelationshipRecord, "dateOfBirth" | "healthStatus">

/**
 * Age today from the stored partial date of birth.
 * A year-only date is 1 July of that year. Deceased people have no current age.
 */
export function estimatedCurrentAge(record: AgeSource, asOf: string): number | null {
  if (record.healthStatus === "deceased") return null
  const age = assessAge(parsePartialDate(record.dateOfBirth), parsePartialDate(asOf), "person")
  if (age.kind === "exact" || age.kind === "approximate") return age.years
  return null
}

export function isMinorChild(
  record: Pick<RelationshipRecord, "relationshipToClient"> & AgeSource,
  asOf = todayDateString()
): boolean {
  const isChild =
    record.relationshipToClient === "child_biological" ||
    record.relationshipToClient === "child_step"
  if (!isChild) return false
  const age = estimatedCurrentAge(record, asOf)
  return age != null && age < 18
}

export function relationshipFieldVisibility(
  record: Pick<RelationshipRecord, "relationshipToClient"> & AgeSource,
  asOf = todayDateString()
): RelationshipFieldVisibility {
  const role = record.relationshipToClient
  const priorPartner = role === "prior_partner"
  const deceased = record.healthStatus === "deceased"
  const parent = PARENT_ROLES.has(role)

  return {
    dateOfBirth: true,
    health: !priorPartner,
    lengthOfRelationship: LENGTH_OF_RELATIONSHIP_ROLES.has(role),
    supportive: true,
    comment: true,
    dependency: !priorPartner && !deceased && !isMinorChild(record, asOf),
    livingSituation: !priorPartner && !deceased,
    clientRelationshipStatus: role === "current_partner",
    howItEnded: priorPartner,
    timeSinceEnded: false,
    spanDates: SPAN_DATE_ROLES.has(role),
    partnerType: priorPartner,
    parentType: parent,
    adoptedOn: parent,
    notKnown: parent,
    laterRelationships: parent,
    childType: role === "child_biological" || role === "child_step",
  }
}

/** Drops values for fields the current type and health status do not show. */
export function applyRelationshipVisibilityDefaults(record: RelationshipRecord): RelationshipRecord {
  const visibility = relationshipFieldVisibility(record)
  const next: RelationshipRecord = { ...record }

  if (!visibility.dateOfBirth) {
    next.dateOfBirth = ""
    next.approximateAge = null
    next.approximateAgeRecordedOn = ""
  }
  if (!visibility.health) {
    next.healthStatus = ""
    next.deceased = false
    next.ageAtDeath = null
    next.dateOfDeath = ""
    next.healthOrCauseOfDeath = ""
  } else if (next.healthStatus !== "deceased") {
    next.deceased = false
    next.ageAtDeath = null
    next.dateOfDeath = ""
    next.healthOrCauseOfDeath = ""
  }
  if (!visibility.lengthOfRelationship) next.lengthOfRelationship = ""
  if (!visibility.howItEnded) {
    next.howEnded = ""
    next.relationshipStatus = ""
  }
  if (!visibility.laterRelationships) next.laterRelationships = ""
  if (!visibility.childType) {
    next.childType = ""
    next.childTypeDetail = ""
  } else if (next.childType !== "other") {
    next.childTypeDetail = ""
  }
  if (!visibility.timeSinceEnded) next.timeSinceEnded = ""
  if (!visibility.spanDates) {
    next.startedOn = ""
    next.endedOn = ""
  }
  if (!visibility.partnerType) next.partnerType = ""
  if (!visibility.parentType) next.parentType = ""
  if (!visibility.notKnown) next.notKnown = false
  if (!visibility.adoptedOn || next.parentType !== "adoptive") next.adoptedOn = ""
  if (!visibility.dependency) {
    next.dependency = isMinorChild(record) ? "they_depend_on_me" : ""
  }
  if (!visibility.livingSituation) next.livingSituation = ""

  return next
}
