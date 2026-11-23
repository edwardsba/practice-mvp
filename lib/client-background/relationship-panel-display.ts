/**
 * Pure display helpers for relationship / person panels (Round Y).
 * Offline-tested; no database access.
 */

import { relationshipDuration } from "@/lib/reports/relationship-block-report"
import { personAge } from "@/lib/reports/background-report-prose"
import {
  ARRANGEMENT_TYPE_LABELS,
  CHILD_TYPE_LABELS,
  CURRENT_BLOCK_STATUS_LABELS,
  NEVER_IN_A_RELATIONSHIP,
  PREVIOUS_BLOCK_STATUS_LABELS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  SIBLING_BLOCK_TYPE_LABELS,
  type ArrangementType,
  type BlockKind,
  type BlockRole,
  type RelationshipBlock,
  type RelationshipLivingSituation,
  type RelationshipRecord,
} from "@/lib/client-background/types"

export const PERSON_FORM_GROUP_IDS = [
  "details",
  "health",
  "living",
  "quality",
] as const

export type PersonFormGroupId = (typeof PERSON_FORM_GROUP_IDS)[number]

export const PERSON_FORM_GROUP_LABELS: Record<PersonFormGroupId, string> = {
  details: "Person's details",
  health: "Health",
  living: "Living situation",
  quality: "Quality of relationship",
}

/** Same four groups, in the same order, for every person role. */
export function personFormGroupOrder(_role: BlockRole | "" | "unplaced"): readonly PersonFormGroupId[] {
  return PERSON_FORM_GROUP_IDS
}

export function yearOf(value: string): string {
  return /^(\d{4})/.exec(value.trim())?.[1] ?? ""
}

/** "2014 · 12 years" — year plus duration; duration omitted when empty. */
export function dateWithDuration(start: string, endOrAsOf: string, asOf: string): string {
  const year = yearOf(start)
  if (!year) return ""
  const duration = relationshipDuration(start, endOrAsOf, asOf)
  return duration ? `${year} · ${duration}` : year
}

export function childrenAnswerLabel(answer: string): string {
  if (answer === "yes") return "Yes"
  if (answer === "none") return "None"
  if (answer === "not_asked") return "Not asked"
  return "Not recorded"
}

export function blockStatusDisplayLabel(status: string): string {
  if (status === NEVER_IN_A_RELATIONSHIP) return "Never in a relationship"
  if (status in CURRENT_BLOCK_STATUS_LABELS) {
    return CURRENT_BLOCK_STATUS_LABELS[status as keyof typeof CURRENT_BLOCK_STATUS_LABELS]
  }
  if (status in PREVIOUS_BLOCK_STATUS_LABELS) {
    return PREVIOUS_BLOCK_STATUS_LABELS[status as keyof typeof PREVIOUS_BLOCK_STATUS_LABELS]
  }
  return status
}

/** Panel subtitle under the status title. */
export function relationshipPanelSubtitle(block: Pick<RelationshipBlock, "kind">): string {
  if (block.kind === "client_current") return "Current relationship"
  if (block.kind === "client_previous") return "Previous relationship"
  if (block.kind === "biological_parents") return "Biological parents"
  if (block.kind === "parent_other") return "Parent's other relationship"
  if (block.kind === "caregiver_arrangement") return "Caregiver arrangement"
  if (block.kind === "client_other_children") return "Other children"
  return "Relationship"
}

/** Short title for the relationship panel header (status / arrangement). */
export function relationshipPanelTitle(block: RelationshipBlock): string {
  if (block.kind === "caregiver_arrangement") {
    if (block.arrangementType === "other") return block.arrangementDetail.trim() || "Other"
    if (block.arrangementType in ARRANGEMENT_TYPE_LABELS) {
      return ARRANGEMENT_TYPE_LABELS[block.arrangementType as ArrangementType]
    }
    return block.arrangementType || "Arrangement"
  }
  if (block.kind === "client_other_children") {
    return block.statusDetail.trim() || "Other children"
  }
  if (block.status === "other") return block.statusDetail.trim() || "Other"
  return blockStatusDisplayLabel(block.status) || "Relationship"
}

/** Role label for cards / Part of (Wife, Son, Sister, …). */
export function personRoleLabel(person: RelationshipRecord, block: RelationshipBlock | null): string {
  if (person.blockRole === "parent") {
    return person.blockRoleType === "father" || person.relationshipToClient === "father" ? "Father" : "Mother"
  }
  if (person.blockRole === "child") {
    if (person.sex === "Female") return "Daughter"
    if (person.sex === "Male") return "Son"
    return "Child"
  }
  if (person.blockRole === "sibling") {
    if (person.sex === "Female") return "Sister"
    if (person.sex === "Male") return "Brother"
    return "Sibling"
  }
  if (person.blockRole === "partner") {
    if (block?.kind === "parent_other") {
      if (person.sex === "Female") return "Step-mother"
      if (person.sex === "Male") return "Step-father"
      return "Partner"
    }
    if (block?.kind === "client_current" && block.status === "married") {
      if (person.sex === "Female") return "Wife"
      if (person.sex === "Male") return "Husband"
    }
    if (block?.kind === "client_previous") {
      if (person.sex === "Female") return "Woman"
      if (person.sex === "Male") return "Man"
    }
    return "Partner"
  }
  const detail = person.caregiverRelationshipDetail.trim()
  if (detail) return detail.slice(0, 1).toUpperCase() + detail.slice(1)
  return "Caregiver"
}

function childTypeShort(type: string): string {
  if (type === "step_child") return "step-child"
  if (type === "biological") return "biological"
  if (type === "adopted") return "adopted"
  if (type === "foster") return "foster"
  if (type === "other") return "other"
  if (type in CHILD_TYPE_LABELS) {
    return CHILD_TYPE_LABELS[type as keyof typeof CHILD_TYPE_LABELS].toLowerCase().replace(/ \(describe\)$/, "")
  }
  return type
}

function siblingTypeShort(type: string): string {
  if (type in SIBLING_BLOCK_TYPE_LABELS) {
    return SIBLING_BLOCK_TYPE_LABELS[type as keyof typeof SIBLING_BLOCK_TYPE_LABELS].toLowerCase()
  }
  return type
}

/** Partner living-situation wording for card subtitles (short). */
export function partnerLivingSituationShort(value: string): string {
  if (value === "lives_with_client_full_time") return "lives with client"
  if (value === "lives_with_client_part_time") return "lives with client part-time"
  if (value === "does_not_live_with_client") return "does not live with client"
  if (value === "previously_lived_with_client") return "previously lived with client"
  if (value === "unknown") return ""
  if (value in RELATIONSHIP_LIVING_SITUATION_LABELS) {
    return RELATIONSHIP_LIVING_SITUATION_LABELS[value as RelationshipLivingSituation].toLowerCase()
  }
  return value
}

/**
 * Card subtitle: role · age · type (child/sibling) or living situation (partner).
 * e.g. "Son · 6 · adopted", "Wife · 49 · lives with client", "Step-child" type uses "step-child".
 */
export function personCardSubtitle(
  person: RelationshipRecord,
  block: RelationshipBlock | null,
  asOf: string
): string {
  const role = personRoleLabel(person, block)
  const age =
    person.dateOfBirth.trim() && !(person.deceased || person.healthStatus === "deceased")
      ? personAge(person.dateOfBirth, asOf)
      : null
  const ageBit = age != null ? String(age) : ""
  let third = ""
  if (person.blockRole === "child") {
    third = childTypeShort(person.blockRoleType ?? "")
  } else if (person.blockRole === "sibling") {
    third = siblingTypeShort(person.blockRoleType ?? "")
  } else if (person.blockRole === "partner") {
    third = partnerLivingSituationShort(person.livingSituation ?? "")
  } else if (person.blockRole === "caregiver") {
    third = (person.blockRoleType ?? "").replace(/_/g, " ")
  }
  return [role, ageBit, third].filter(Boolean).join(" · ")
}

function statusSinceBit(block: RelationshipBlock): string {
  const status =
    block.kind === "caregiver_arrangement"
      ? relationshipPanelTitle(block)
      : block.status === "other"
        ? block.statusDetail.trim() || "Other"
        : blockStatusDisplayLabel(block.status) || "Relationship"
  const year = yearOf(block.startedOn)
  if (year && (block.kind === "client_current" || !block.endedOn.trim())) {
    return `${status} since ${year}`
  }
  if (year && block.endedOn.trim()) {
    const end = yearOf(block.endedOn)
    return end ? `${status} ${year}–${end}` : `${status} from ${year}`
  }
  return status
}

/**
 * "Part of" line for a person view (without the trailing chevron).
 * e.g. "Child of Tom and Jordan · Married since 2014"
 * e.g. "Wife · Married since 2014"
 */
export function partOfLine(
  person: RelationshipRecord,
  block: RelationshipBlock | null,
  people: RelationshipRecord[],
  clientName = "Client"
): string {
  if (!block) return "Not placed"
  const since = statusSinceBit(block)
  if (person.blockRole === "child") {
    const partners = people
      .filter((item) => item.relationshipBlockId === block.relationshipBlockId && item.blockRole === "partner")
      .sort((a, b) => a.displayOrder - b.displayOrder)
    const partnerName = partners.find((item) => item.givenName.trim())?.givenName.trim() ?? ""
    const of = partnerName ? `Child of ${clientName} and ${partnerName}` : `Child of ${clientName}`
    return `${of} · ${since}`
  }
  if (person.blockRole === "sibling") {
    return `Sibling · ${since}`
  }
  if (person.blockRole === "parent") {
    return `${personRoleLabel(person, block)} · ${since}`
  }
  if (person.blockRole === "caregiver") {
    return `Caregiver · ${since}`
  }
  // partner
  return `${personRoleLabel(person, block)} · ${since}`
}

/**
 * Context line for an existing person form (edit).
 * Same shape as Part of without implying navigation.
 */
export function existingPersonContextLine(
  person: RelationshipRecord,
  block: RelationshipBlock | null,
  people: RelationshipRecord[],
  clientName = "Client"
): string {
  return partOfLine(person, block, people, clientName)
}

/** Which people groups appear on a relationship view / form, in order. */
export function relationshipViewGroups(kind: BlockKind): { id: string; label: string; role: BlockRole | null }[] {
  if (kind === "client_current" || kind === "client_previous") {
    return [
      { id: "relationship", label: "Relationship", role: null },
      { id: "partner", label: "Partner", role: "partner" },
      { id: "children", label: "Children", role: "child" },
    ]
  }
  if (kind === "biological_parents") {
    return [
      { id: "relationship", label: "Relationship", role: null },
      { id: "parents", label: "Parents", role: "parent" },
      { id: "siblings", label: "Siblings", role: "sibling" },
    ]
  }
  if (kind === "parent_other") {
    return [
      { id: "relationship", label: "Relationship", role: null },
      { id: "partner", label: "Partner", role: "partner" },
      { id: "siblings", label: "Siblings", role: "sibling" },
    ]
  }
  if (kind === "caregiver_arrangement") {
    return [
      { id: "arrangement", label: "Arrangement", role: null },
      { id: "caregiver", label: "Caregiver", role: "caregiver" },
    ]
  }
  if (kind === "client_other_children") {
    return [
      { id: "relationship", label: "Relationship", role: null },
      { id: "children", label: "Children", role: "child" },
    ]
  }
  return [{ id: "relationship", label: "Relationship", role: null }]
}
