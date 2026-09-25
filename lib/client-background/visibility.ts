import type { RelationshipRecord } from "@/lib/client-background/types"

export type RelationshipFieldVisibility = {
  qualityOfRelationship: boolean
  dependency: boolean
  livingSituation: boolean
  timeSinceEnded: boolean
  relationshipStatus: boolean
}

export function isMinorChild(
  record: Pick<RelationshipRecord, "relationshipToClient" | "age">
): boolean {
  const isChild =
    record.relationshipToClient === "child_biological" ||
    record.relationshipToClient === "child_step"
  return isChild && record.age != null && record.age < 18
}

export function relationshipFieldVisibility(
  record: Pick<RelationshipRecord, "relationshipToClient" | "age">
): RelationshipFieldVisibility {
  const isPartner =
    record.relationshipToClient === "current_partner" ||
    record.relationshipToClient === "prior_partner"

  if (record.relationshipToClient === "prior_partner") {
    return {
      qualityOfRelationship: false,
      dependency: false,
      livingSituation: false,
      timeSinceEnded: true,
      relationshipStatus: true,
    }
  }

  if (isMinorChild(record)) {
    return {
      qualityOfRelationship: true,
      dependency: false,
      livingSituation: true,
      timeSinceEnded: false,
      relationshipStatus: false,
    }
  }

  return {
    qualityOfRelationship: true,
    dependency: true,
    livingSituation: true,
    timeSinceEnded: false,
    relationshipStatus: isPartner,
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
