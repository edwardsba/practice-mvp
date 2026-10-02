import { completedYearsBetween } from "@/lib/client-background/age"
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

type AgeSource = Pick<
  RelationshipRecord,
  "dateOfBirth" | "approximateAge" | "approximateAgeRecordedOn" | "healthStatus"
>

/**
 * Age used for rules such as "child under 18". A date of birth is exact.
 * An approximate age is moved forward by the years since it was recorded,
 * so a figure from years ago is not treated as today's age.
 */
export function estimatedCurrentAge(record: AgeSource, asOf: string): number | null {
  if (record.healthStatus === "deceased") return null
  if (record.dateOfBirth) return completedYearsBetween(record.dateOfBirth, asOf)
  if (record.approximateAge == null) return null
  if (!record.approximateAgeRecordedOn) return record.approximateAge
  const elapsed = completedYearsBetween(record.approximateAgeRecordedOn, asOf)
  if (elapsed == null) return record.approximateAge
  const age = record.approximateAge + elapsed
  if (age < 0 || age > 130) return null
  return age
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
