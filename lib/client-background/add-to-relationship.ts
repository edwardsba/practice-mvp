import { addChoicesForBlockKind } from "@/lib/client-background/tree-add"
import {
  ARRANGEMENT_TYPE_LABELS,
  CURRENT_BLOCK_STATUS_LABELS,
  NEVER_IN_A_RELATIONSHIP,
  PREVIOUS_BLOCK_STATUS_LABELS,
  type ArrangementType,
  type BlockKind,
  type BlockRole,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"

export type AddToRelationshipOption = {
  role: BlockRole
  label: string
}

/**
 * Menu options for ⊕ on a relationship line.
 * Intimate: Partner + Child. Parents' other: Partner + Sibling.
 * Biological: Sibling. Caregiver: Caregiver + Sibling. Other children: Child.
 */
export function addToRelationshipMenuOptions(kind: BlockKind): AddToRelationshipOption[] {
  const choices = addChoicesForBlockKind(kind)
  if (!choices) return []
  return choices
    .filter((choice) =>
      choice.id === "partner" ||
      choice.id === "child" ||
      choice.id === "sibling" ||
      choice.id === "caregiver" ||
      choice.id === "parent"
    )
    .map((choice) => ({ role: choice.id as BlockRole, label: choice.label }))
}

export function relationshipLineSupportsAddMenu(kind: BlockKind): boolean {
  return addToRelationshipMenuOptions(kind).length > 0
}

function blockStatusLabel(status: string): string {
  if (status === NEVER_IN_A_RELATIONSHIP) return "Never in a relationship"
  if (status in CURRENT_BLOCK_STATUS_LABELS) {
    return CURRENT_BLOCK_STATUS_LABELS[status as keyof typeof CURRENT_BLOCK_STATUS_LABELS]
  }
  if (status in PREVIOUS_BLOCK_STATUS_LABELS) {
    return PREVIOUS_BLOCK_STATUS_LABELS[status as keyof typeof PREVIOUS_BLOCK_STATUS_LABELS]
  }
  if (status in ARRANGEMENT_TYPE_LABELS) {
    return ARRANGEMENT_TYPE_LABELS[status as ArrangementType]
  }
  return status
}

function yearSpan(block: Pick<RelationshipBlock, "startedOn" | "endedOn" | "kind">): string {
  const year = (value: string) => /^(\d{4})/.exec(value.trim())?.[1] ?? ""
  const start = year(block.startedOn)
  const end = year(block.endedOn)
  if (start && end && block.endedOn.trim() && block.kind !== "client_current") return `${start}–${end}`
  if (start && (block.kind === "client_current" || !block.endedOn.trim())) return `since ${start}`
  if (start) return start
  if (end) return `until ${end}`
  return ""
}

/** Menu heading: "Add to Married (since 2014)". */
export function addToRelationshipMenuHeading(
  block: Pick<RelationshipBlock, "status" | "startedOn" | "endedOn" | "kind">
): string {
  const status = blockStatusLabel(block.status) || "Relationship"
  const dates = yearSpan(block)
  return dates ? `Add to ${status} (${dates})` : `Add to ${status}`
}

function firstPartnerName(people: RelationshipRecord[], blockId: string): string {
  return (
    people
      .filter((person) => person.relationshipBlockId === blockId && person.blockRole === "partner")
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .find((person) => person.givenName.trim())
      ?.givenName.trim() ?? ""
  )
}

/** Context strip for the new-person draft: "Adding to: Married (since 2014) · Jordan". */
export function addingToContextLine(
  block: Pick<RelationshipBlock, "relationshipBlockId" | "status" | "startedOn" | "endedOn" | "kind">,
  people: RelationshipRecord[]
): string {
  const status = blockStatusLabel(block.status) || "Relationship"
  const dates = yearSpan(block)
  const left = dates ? `${status} (${dates})` : status
  const partner = firstPartnerName(people, block.relationshipBlockId)
  return partner ? `Adding to: ${left} · ${partner}` : `Adding to: ${left}`
}

/** Child Type option label; step_child includes the partner's name when known. */
export function childTypeOptionLabel(type: string, partnerName: string): string {
  if (type === "biological") return "Biological"
  if (type === "adopted") return "Adopted"
  if (type === "step_child") {
    return partnerName ? `Step-child (${partnerName}'s)` : "Step-child"
  }
  if (type === "foster") return "Foster"
  if (type === "other") return "Other"
  return type
}

export function firstPartnerGivenName(people: RelationshipRecord[], blockId: string): string {
  return firstPartnerName(people, blockId)
}
