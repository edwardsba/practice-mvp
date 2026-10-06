import { assessAge } from "@/lib/client-background/age"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import type { RelationshipRecord } from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"

export type RelationshipFieldVisibility = {
  qualityOfRelationship: boolean
  dependency: boolean
  livingSituation: boolean
  timeSinceEnded: boolean
  relationshipStatus: boolean
  lengthOfRelationship: boolean
}

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
  const isPartner =
    record.relationshipToClient === "current_partner" ||
    record.relationshipToClient === "prior_partner"
  const lengthOfRelationship = record.relationshipToClient !== "sibling_full"

  if (record.relationshipToClient === "prior_partner") {
    return {
      qualityOfRelationship: false,
      dependency: false,
      livingSituation: false,
      timeSinceEnded: true,
      relationshipStatus: true,
      lengthOfRelationship,
    }
  }

  if (isMinorChild(record, asOf)) {
    return {
      qualityOfRelationship: true,
      dependency: false,
      livingSituation: true,
      timeSinceEnded: false,
      relationshipStatus: false,
      lengthOfRelationship,
    }
  }

  return {
    qualityOfRelationship: true,
    dependency: true,
    livingSituation: true,
    timeSinceEnded: false,
    relationshipStatus: isPartner,
    lengthOfRelationship,
  }
}

export function applyRelationshipVisibilityDefaults(
  record: RelationshipRecord
): RelationshipRecord {
  const next = record.relationshipToClient === "sibling_full" ? { ...record, lengthOfRelationship: "" } : record
  if (isMinorChild(next)) {
    return { ...next, dependency: "they_depend_on_me" }
  }
  if (next.relationshipToClient === "prior_partner") {
    return {
      ...next,
      qualityOfRelationship: "",
      dependency: "",
      livingSituation: "",
    }
  }
  return next
}
