import { assessAge } from "@/lib/client-background/age"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import type { RelationshipRecord, RelationshipToClient } from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"

export type RelationshipFieldVisibility = {
  dateOfBirth: boolean
  health: boolean
  lengthOfRelationship: boolean
  supportive: boolean
  comment: boolean
  dependency: boolean
  livingSituation: boolean
  clientRelationshipStatus: boolean
  howItEnded: boolean
  timeSinceEnded: boolean
}

const LENGTH_OF_RELATIONSHIP_ROLES = new Set<RelationshipToClient>([
  "other_caregiver",
  "step_parent",
  "sibling_step",
  "current_partner",
  "prior_partner",
  "child_step",
])

type AgeSource = Pick<RelationshipRecord, "dateOfBirth" | "healthStatus">

/**
 * Age today from the stored partial date of birth.
 * A year-only date uses the difference in calendar years. Deceased people have no current age.
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

  return {
    dateOfBirth: !priorPartner,
    health: !priorPartner,
    lengthOfRelationship: LENGTH_OF_RELATIONSHIP_ROLES.has(role),
    supportive: true,
    comment: true,
    dependency: !priorPartner && !deceased && !isMinorChild(record, asOf),
    livingSituation: !priorPartner && !deceased,
    clientRelationshipStatus: role === "current_partner",
    howItEnded: priorPartner,
    timeSinceEnded: priorPartner,
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
  if (!visibility.howItEnded) next.relationshipStatus = ""
  if (!visibility.timeSinceEnded) next.timeSinceEnded = ""
  if (!visibility.dependency) {
    next.dependency = isMinorChild(record) ? "they_depend_on_me" : ""
  }
  if (!visibility.livingSituation) next.livingSituation = ""

  return next
}
