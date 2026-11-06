import {
  ARRANGEMENT_TYPE_LABELS,
  ARRANGEMENT_TYPES,
  BLOCK_ANSWERS,
  CHILD_TYPES,
  CURRENT_BLOCK_STATUS_LABELS,
  CURRENT_BLOCK_STATUSES,
  NEVER_IN_A_RELATIONSHIP,
  PARTNERED_CLIENT_STATUSES,
  PREVIOUS_BLOCK_STATUS_LABELS,
  PREVIOUS_BLOCK_STATUSES,
  SIBLING_BLOCK_TYPES,
  type ArrangementType,
  type BlockAnswer,
  type BlockKind,
  type BlockRole,
  type ChildType,
  type CurrentBlockStatus,
  type PreviousBlockStatus,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
  type RelationshipToClient,
  type SiblingBlockType,
} from "@/lib/client-background/types"


export function isPartneredClientStatus(status: string): boolean {
  return (PARTNERED_CLIENT_STATUSES as readonly string[]).includes(status)
}

export function statusesForBlock(kind: BlockKind): readonly string[] {
  if (kind === "client_current") return CURRENT_BLOCK_STATUSES
  if (kind === "client_previous") return PREVIOUS_BLOCK_STATUSES
  if (kind === "biological_parents") return [...CURRENT_BLOCK_STATUSES, ...PREVIOUS_BLOCK_STATUSES, NEVER_IN_A_RELATIONSHIP]
  if (kind === "parent_other") return [...CURRENT_BLOCK_STATUSES, ...PREVIOUS_BLOCK_STATUSES]
  return []
}

export function siblingTypesForBlock(kind: BlockKind): readonly SiblingBlockType[] {
  if (kind === "biological_parents") return ["full", "adopted"]
  if (kind === "parent_other") return ["half", "step"]
  if (kind === "caregiver_arrangement") return ["adoptive", "foster", "other"]
  return []
}

export function rolesForBlock(kind: BlockKind): readonly BlockRole[] {
  if (kind === "client_current" || kind === "client_previous") return ["partner", "child"]
  if (kind === "client_other_children") return ["child"]
  if (kind === "biological_parents") return ["parent", "sibling"]
  if (kind === "parent_other") return ["partner", "sibling"]
  if (kind === "caregiver_arrangement") return ["caregiver", "sibling"]
  return []
}

export function answerKeyForBlock(
  block: Pick<RelationshipBlock, "kind" | "parentSide">
): keyof RelationshipBlockAnswers | null {
  if (block.kind === "client_previous") return "previousRelationships"
  if (block.kind === "client_other_children") return "otherChildren"
  if (block.kind === "parent_other" && block.parentSide === "mother") return "motherOtherRelationships"
  if (block.kind === "parent_other" && block.parentSide === "father") return "fatherOtherRelationships"
  if (block.kind === "caregiver_arrangement") return "caregiverArrangements"
  return null
}

export function childTypesForBlock(kind: BlockKind): readonly ChildType[] {
  if (kind === "client_current" || kind === "client_previous" || kind === "client_other_children") return CHILD_TYPES
  return []
}

/** Adding a block sets Yes. Removing the last one sets Not asked, never None. */
export function answerAfterBlockCount(count: number): "yes" | "not_asked" {
  return count > 0 ? "yes" : "not_asked"
}

/** Sent when Move to should create the block and then place the person in it. */
export const NEW_CURRENT_RELATIONSHIP = "new-current-relationship"
export const NEW_PREVIOUS_RELATIONSHIP = "new-previous-relationship"

export function relationshipBlockLabel(block: RelationshipBlock): string {
  const status = block.status.trim()
  const statusText =
    status in CURRENT_BLOCK_STATUS_LABELS
      ? CURRENT_BLOCK_STATUS_LABELS[status as keyof typeof CURRENT_BLOCK_STATUS_LABELS]
      : status in PREVIOUS_BLOCK_STATUS_LABELS
        ? PREVIOUS_BLOCK_STATUS_LABELS[status as keyof typeof PREVIOUS_BLOCK_STATUS_LABELS]
        : status === NEVER_IN_A_RELATIONSHIP
          ? "Never in a relationship"
          : block.arrangementType in ARRANGEMENT_TYPE_LABELS
            ? ARRANGEMENT_TYPE_LABELS[block.arrangementType as keyof typeof ARRANGEMENT_TYPE_LABELS]
            : ""
  const title =
    block.kind === "client_current"
      ? "Current relationship"
      : block.kind === "client_previous"
        ? "Previous relationship"
        : block.kind === "client_other_children"
          ? "Other children"
          : block.kind === "biological_parents"
            ? "Biological parents"
            : block.kind === "parent_other"
              ? block.parentSide === "father"
                ? "Father's other relationship"
                : "Mother's other relationship"
              : "Care arrangement"
  const when = block.startedOn.trim() ? `, from ${block.startedOn.trim()}` : ""
  return statusText ? `${title} (${statusText}${when})` : title
}

export function moveDestinations(blocks: RelationshipBlock[]): { id: string; label: string }[] {
  return [
    ...blocks.map((block) => ({ id: block.relationshipBlockId, label: relationshipBlockLabel(block) })),
    { id: NEW_CURRENT_RELATIONSHIP, label: "+ New current relationship" },
    { id: NEW_PREVIOUS_RELATIONSHIP, label: "+ New previous relationship" },
  ]
}

export function moveDestinationKind(blocks: RelationshipBlock[], destinationId: string): BlockKind | null {
  if (destinationId === NEW_CURRENT_RELATIONSHIP) return "client_current"
  if (destinationId === NEW_PREVIOUS_RELATIONSHIP) return "client_previous"
  return blocks.find((block) => block.relationshipBlockId === destinationId)?.kind ?? null
}

export function previousBlocksInOrder(blocks: RelationshipBlock[]): RelationshipBlock[] {
  return blocks
    .filter((block) => block.kind === "client_previous")
    .sort((a, b) => {
      if (a.startedOn !== b.startedOn) return b.startedOn.localeCompare(a.startedOn)
      return a.displayOrder - b.displayOrder
    })
}

export function legacyRoleForMember(kind: BlockKind, role: BlockRole, roleType: string): RelationshipToClient {
  if (role === "partner") {
    if (kind === "client_previous") return "prior_partner"
    if (kind === "parent_other") return "step_parent"
    return "current_partner"
  }
  if (role === "child") return roleType === "step_child" ? "child_step" : "child_biological"
  if (role === "parent") {
    if (roleType === "father") return "father"
    if (roleType === "mother") return "mother"
    return "parent"
  }
  if (role === "sibling") {
    if (roleType === "half") return "sibling_half"
    if (roleType === "step") return "sibling_step"
    if (roleType === "full") return "sibling_full"
    return "sibling_adoptive"
  }
  return "other_caregiver"
}

export function isCurrentBlockStatus(status: string): status is CurrentBlockStatus {
  return (CURRENT_BLOCK_STATUSES as readonly string[]).includes(status)
}

export function isPreviousBlockStatus(status: string): status is PreviousBlockStatus {
  return (PREVIOUS_BLOCK_STATUSES as readonly string[]).includes(status)
}

export function isBlockAnswer(value: string): value is BlockAnswer {
  return (BLOCK_ANSWERS as readonly string[]).includes(value)
}

export function isArrangementType(value: string): value is ArrangementType {
  return (ARRANGEMENT_TYPES as readonly string[]).includes(value)
}

export function isSiblingBlockType(value: string): value is SiblingBlockType {
  return (SIBLING_BLOCK_TYPES as readonly string[]).includes(value)
}

export type FieldNeed = "status" | "start" | "end" | "sex" | "age" | "type"

export function needsForBlock(block: RelationshipBlock, lockedStatus: boolean): FieldNeed[] {
  const needs: FieldNeed[] = []
  const startedKinds: BlockKind[] = ["client_current", "client_previous"]
  const endedKinds: BlockKind[] = ["client_previous"]
  if (!lockedStatus && (block.kind === "client_current" || block.kind === "client_previous") && !block.status.trim()) {
    needs.push("status")
  }
  if (startedKinds.includes(block.kind) && !block.startedOn.trim()) needs.push("start")
  if (endedKinds.includes(block.kind) && !block.endedOn.trim()) needs.push("end")
  if (block.kind === "caregiver_arrangement" && !block.arrangementType) needs.push("type")
  return needs
}

export function needsForMember(block: RelationshipBlock, person: RelationshipRecord): FieldNeed[] {
  const needs: FieldNeed[] = []
  const role = person.blockRole
  if (role === "partner") {
    if (!person.sex.trim()) needs.push("sex")
    if (!person.dateOfBirth.trim()) needs.push("age")
  }
  if (role === "child") {
    if (!(person.blockRoleType ?? "").trim() && !person.childType) needs.push("type")
    if (!person.dateOfBirth.trim()) needs.push("age")
  }
  if (role === "sibling" && siblingTypesForBlock(block.kind).length > 1 && !(person.blockRoleType ?? "").trim()) needs.push("type")
  if (role === "caregiver" && block.arrangementType !== "adoption" && !(person.blockRoleType ?? "").trim() && !person.caregiverRelationship.trim()) {
    needs.push("type")
  }
  return needs
}

export function needLabel(need: FieldNeed): string {
  if (need === "status") return "Needs status"
  if (need === "start") return "Needs start"
  if (need === "end") return "Needs end"
  if (need === "sex") return "Needs sex"
  if (need === "age") return "Needs age"
  return "Needs type"
}
