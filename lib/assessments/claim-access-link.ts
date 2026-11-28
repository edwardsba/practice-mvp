/**
 * Double-submit guard for assessment access links.
 * Claim with UPDATE … WHERE access_status = 'active' RETURNING;
 * zero rows means another request already used the link.
 */

export const LINK_ALREADY_USED_MESSAGE = "This link has already been used."

export class LinkAlreadyUsedError extends Error {
  constructor(message = LINK_ALREADY_USED_MESSAGE) {
    super(message)
    this.name = "LinkAlreadyUsedError"
  }
}

export type ClaimAccessLinkOutcome =
  | { claimed: true }
  | { claimed: false; error: typeof LINK_ALREADY_USED_MESSAGE }

/** Pure: interpret rows returned by the conditional link update. */
export function claimAccessLinkOutcome(
  returningRows: ReadonlyArray<unknown>
): ClaimAccessLinkOutcome {
  if (returningRows.length > 0) return { claimed: true }
  return { claimed: false, error: LINK_ALREADY_USED_MESSAGE }
}

export function assertAccessLinkClaimed(
  returningRows: ReadonlyArray<unknown>
): void {
  const outcome = claimAccessLinkOutcome(returningRows)
  if (!outcome.claimed) {
    throw new LinkAlreadyUsedError(outcome.error)
  }
}
