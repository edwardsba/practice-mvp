/**
 * Browser-only person draft validation for relationship Save.
 * Nothing is written until Save; empty drafts are refused on the server too.
 */

export const EMPTY_PERSON_DRAFT_ERROR =
  "Enter a name or choose a type before saving."

export const ONE_CURRENT_RELATIONSHIP_ERROR =
  "This client already has a current relationship. Add another partner to it with +, or end it first."

export type PersonDraftContent = {
  givenName: string
  blockRoleType?: string | null
}

/** Save stays disabled until a name or a type is filled in. */
export function personDraftHasRequiredContent(draft: PersonDraftContent): boolean {
  return Boolean(draft.givenName.trim() || (draft.blockRoleType ?? "").trim())
}

/** Server-side guard — same rule as the Save button. */
export function refuseEmptyPersonDraft(draft: PersonDraftContent): string | null {
  if (personDraftHasRequiredContent(draft)) return null
  return EMPTY_PERSON_DRAFT_ERROR
}

/** Pure check used by mutations and offline self-tests. */
export function refuseSecondCurrentFromBlocks(
  blocks: { kind: string }[],
  kind: string
): string | null {
  if (kind !== "client_current") return null
  if (blocks.some((block) => block.kind === "client_current")) {
    return ONE_CURRENT_RELATIONSHIP_ERROR
  }
  return null
}
