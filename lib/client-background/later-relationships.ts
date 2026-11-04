export const LATER_RELATIONSHIPS = ["yes", "none", "not_asked"] as const
export type LaterRelationships = (typeof LATER_RELATIONSHIPS)[number]

export const LATER_RELATIONSHIP_LABELS: Record<LaterRelationships, string> = {
  yes: "Yes",
  none: "None",
  not_asked: "Not asked",
}

/**
 * Linking a step-parent sets Yes. Removing the last link returns Not asked.
 * None is never chosen here; only the practitioner sets it.
 */
export function laterRelationshipsAfterLinkChange(remainingLinks: number): "yes" | "not_asked" {
  return remainingLinks > 0 ? "yes" : "not_asked"
}
