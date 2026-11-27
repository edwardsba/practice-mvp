/**
 * Interview sections 5, 6, 8 and 9 answer their questions under the tree
 * headings (Round AQ). Maps each heading to its answers_json item.
 * Pure — no database.
 */

import {
  historyScreeningKeyFromItemKey,
  isQuestionKind,
  isValueAllowedForKind,
  kindForInterviewItemKey,
  type InterviewItemAnswer,
} from "@/lib/client-background/interview-answers"
import type { HistoryQuestionKey } from "@/lib/client-background/interview-history"

/**
 * Relationship tree headings that carry an interview answer.
 * `children` and `siblings` are interview-only summary headings: children and
 * siblings sit under their own relationships, so no existing heading covers them all.
 */
export const RELATIONSHIP_TREE_HEADINGS = [
  "current",
  "previous",
  "children",
  "biological_parents",
  "mother_other",
  "father_other",
  "caregiver",
  "siblings",
] as const

export type RelationshipTreeHeading = (typeof RELATIONSHIP_TREE_HEADINGS)[number]

const RELATIONSHIP_HEADING_ITEM_KEYS: Record<RelationshipTreeHeading, string> = {
  current: "s5_current",
  previous: "s5_previous",
  children: "s5_children",
  biological_parents: "s6_biological_parents",
  mother_other: "s6_mother_other",
  father_other: "s6_father_other",
  caregiver: "s6_caregiver",
  siblings: "s6_siblings",
}

export type TreeHeadingRef =
  | { tree: "relationships"; heading: RelationshipTreeHeading }
  | { tree: "history"; screeningKey: HistoryQuestionKey }

/** answers_json item shown under a tree heading, or null when none matches. */
export function interviewItemKeyForTreeHeading(ref: TreeHeadingRef): string | null {
  if (ref.tree === "relationships") return RELATIONSHIP_HEADING_ITEM_KEYS[ref.heading] ?? null
  for (const key of [`s8_${ref.screeningKey}`, `s9_${ref.screeningKey}`]) {
    if (historyScreeningKeyFromItemKey(key) === ref.screeningKey) return key
  }
  return null
}

/**
 * Item that ⊕ under this heading answers Yes. Null when the heading has no
 * Yes answer (Biological parents is a details item signed off by Confirm section).
 */
export function interviewYesItemForTreeHeading(ref: TreeHeadingRef): string | null {
  const key = interviewItemKeyForTreeHeading(ref)
  if (!key) return null
  const kind = kindForInterviewItemKey(key)
  if (!kind || !isQuestionKind(kind) || !isValueAllowedForKind(kind, "yes")) return null
  return key
}

/** ⊕ writes Yes unless the item already holds a confirmed Yes. */
export function headingAddNeedsYes(answer: InterviewItemAnswer | undefined): boolean {
  return !(answer?.value === "yes" && answer.confirmed)
}
