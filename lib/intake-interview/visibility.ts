import type { RelationshipRecord } from "@/lib/intake-interview/types"

export type RelationshipFieldVisibility = {
  qualityOfRelationship: boolean
  dependency: boolean
  livingSituation: boolean
  timeSinceEnded: boolean
}

export function isMinorChild(record: Pick<RelationshipRecord, "relationshipToClient" | "age">): boolean {
  const isChild =
    record.relationshipToClient === "child_biological" ||
    record.relationshipToClient === "child_step"
  return isChild && record.age != null && record.age < 18
}

export function relationshipFieldVisibility(
  record: Pick<RelationshipRecord, "relationshipToClient" | "age">
): RelationshipFieldVisibility {
  if (record.relationshipToClient === "prior_partner") {
    return {
      qualityOfRelationship: false,
      dependency: false,
      livingSituation: false,
      timeSinceEnded: true,
    }
  }

  if (isMinorChild(record)) {
    return {
      qualityOfRelationship: true,
      dependency: false,
      livingSituation: true,
      timeSinceEnded: false,
    }
  }

  return {
    qualityOfRelationship: true,
    dependency: true,
    livingSituation: true,
    timeSinceEnded: false,
  }
}

export function applyRelationshipVisibilityDefaults(
  record: RelationshipRecord
): RelationshipRecord {
  if (isMinorChild(record)) {
    return { ...record, dependency: "they_depend_on_me" }
  }
  if (record.relationshipToClient === "prior_partner") {
    return {
      ...record,
      qualityOfRelationship: "",
      dependency: "",
      livingSituation: "",
    }
  }
  return record
}
