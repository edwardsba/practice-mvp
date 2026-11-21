import type { RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"

/**
 * True when a newly opened relationship form still has no practitioner-entered
 * content — block and first partner/caregiver should both be removed on close.
 */
export function isEmptyNewRelationshipDraft(
  block: Pick<
    RelationshipBlock,
    | "status"
    | "statusDetail"
    | "arrangementType"
    | "arrangementDetail"
    | "startedOn"
    | "endedOn"
    | "childrenAnswer"
    | "siblingsAnswer"
    | "noChildren"
  >,
  member: Pick<
    RelationshipRecord,
    | "givenName"
    | "sex"
    | "dateOfBirth"
    | "healthStatus"
    | "dateOfDeath"
    | "blockRoleType"
    | "caregiverRelationship"
    | "notKnown"
    | "deceased"
  >
): boolean {
  const blockEmpty =
    !block.status.trim() &&
    !block.statusDetail.trim() &&
    !block.arrangementType.trim() &&
    !block.arrangementDetail.trim() &&
    !block.startedOn.trim() &&
    !block.endedOn.trim() &&
    !block.childrenAnswer &&
    !block.siblingsAnswer &&
    !block.noChildren
  const memberEmpty =
    !member.givenName.trim() &&
    !member.sex.trim() &&
    !member.dateOfBirth.trim() &&
    !member.healthStatus.trim() &&
    !member.dateOfDeath.trim() &&
    !(member.blockRoleType ?? "").trim() &&
    !(member.caregiverRelationship ?? "").trim() &&
    !member.notKnown &&
    !member.deceased
  return blockEmpty && memberEmpty
}
