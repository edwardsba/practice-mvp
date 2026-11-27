/**
 * Interview relationship trees hold unsaved section drafts (status, dates,
 * children / siblings answers) until Save section. Sections 5 and 6 each
 * mount a tree, so fresh props arrive while the other tree has drafts.
 * Rebase keeps a draft unless the incoming value for that field changed.
 * Pure — no database.
 */

import type {
  ClientRelationshipStatusValue,
  RelationshipBlock,
  RelationshipBlockAnswers,
} from "@/lib/client-background/types"

const BLOCK_FIELDS = [
  "relationshipBlockId",
  "kind",
  "parentRecordId",
  "parentSide",
  "status",
  "statusDetail",
  "arrangementType",
  "arrangementDetail",
  "startedOn",
  "endedOn",
  "childrenAnswer",
  "siblingsAnswer",
  "displayOrder",
] as const satisfies readonly (keyof RelationshipBlock)[]

export function sameRelationshipBlock(a: RelationshipBlock, b: RelationshipBlock): boolean {
  return BLOCK_FIELDS.every((field) => a[field] === b[field])
}

/** Incoming blocks, keeping the local draft of any block the incoming list left unchanged. */
export function rebaseBlockDrafts(
  draft: readonly RelationshipBlock[],
  previous: readonly RelationshipBlock[],
  next: readonly RelationshipBlock[]
): RelationshipBlock[] {
  const draftById = new Map(draft.map((block) => [block.relationshipBlockId, block]))
  const previousById = new Map(previous.map((block) => [block.relationshipBlockId, block]))
  return next.map((block) => {
    const local = draftById.get(block.relationshipBlockId)
    const prior = previousById.get(block.relationshipBlockId)
    if (!local || !prior || !sameRelationshipBlock(prior, block)) return block
    return local
  })
}

export function rebaseBlockAnswerDrafts(
  draft: RelationshipBlockAnswers,
  previous: RelationshipBlockAnswers,
  next: RelationshipBlockAnswers
): RelationshipBlockAnswers {
  const out: RelationshipBlockAnswers = { ...next }
  for (const key of Object.keys(next) as (keyof RelationshipBlockAnswers)[]) {
    if (previous[key] === next[key]) out[key] = draft[key]
  }
  return out
}

export function rebaseStatusDraft(
  draft: ClientRelationshipStatusValue,
  previous: ClientRelationshipStatusValue,
  next: ClientRelationshipStatusValue
): ClientRelationshipStatusValue {
  const unchanged =
    previous.relationshipStatus === next.relationshipStatus &&
    previous.relationshipStatusOther === next.relationshipStatusOther
  return unchanged ? draft : next
}
