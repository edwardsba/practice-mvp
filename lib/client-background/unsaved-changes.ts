import type {
  ClientRelationshipStatusValue,
  RelationshipBlock,
  RelationshipBlockAnswers,
} from "@/lib/client-background/types"

export type RelationshipSectionSnapshot = {
  blocks: RelationshipBlock[]
  blockAnswers: RelationshipBlockAnswers
  relationshipStatus: ClientRelationshipStatusValue
}

function blockKey(block: RelationshipBlock): string {
  return [
    block.relationshipBlockId,
    block.kind,
    block.status,
    block.statusDetail,
    block.arrangementType,
    block.arrangementDetail,
    block.startedOn,
    block.endedOn,
    block.childrenAnswer,
    block.siblingsAnswer,
    block.parentSide,
  ].join("|")
}

function answersKey(answers: RelationshipBlockAnswers): string {
  return [
    answers.previousRelationships,
    answers.otherChildren,
    answers.motherOtherRelationships,
    answers.fatherOtherRelationships,
    answers.caregiverArrangements,
  ].join("|")
}

function statusKey(status: ClientRelationshipStatusValue): string {
  return `${status.relationshipStatus}|${status.relationshipStatusOther}`
}

/**
 * Count how many field-groups differ between baseline and draft for the
 * interview "N unsaved changes" line. Each changed block, answer key, or
 * client status counts as one.
 */
export function countUnsavedRelationshipChanges(
  baseline: RelationshipSectionSnapshot,
  draft: RelationshipSectionSnapshot
): number {
  let count = 0
  if (statusKey(baseline.relationshipStatus) !== statusKey(draft.relationshipStatus)) count += 1

  const baseAnswers = answersKey(baseline.blockAnswers)
  const draftAnswers = answersKey(draft.blockAnswers)
  if (baseAnswers !== draftAnswers) {
    const keys: (keyof RelationshipBlockAnswers)[] = [
      "previousRelationships",
      "otherChildren",
      "motherOtherRelationships",
      "fatherOtherRelationships",
      "caregiverArrangements",
    ]
    for (const key of keys) {
      if (baseline.blockAnswers[key] !== draft.blockAnswers[key]) count += 1
    }
  }

  const baseMap = new Map(baseline.blocks.map((block) => [block.relationshipBlockId, blockKey(block)]))
  const draftIds = new Set(draft.blocks.map((block) => block.relationshipBlockId))
  for (const block of draft.blocks) {
    const prior = baseMap.get(block.relationshipBlockId)
    if (prior == null || prior !== blockKey(block)) count += 1
  }
  for (const id of baseMap.keys()) {
    if (!draftIds.has(id)) count += 1
  }
  return count
}

export function relationshipSectionIsDirty(
  baseline: RelationshipSectionSnapshot,
  draft: RelationshipSectionSnapshot
): boolean {
  return countUnsavedRelationshipChanges(baseline, draft) > 0
}
