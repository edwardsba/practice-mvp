/**
 * Shared New relationship / New arrangement form identity (board AE / Round R).
 * Interview and Client Background both open this same form — not the old AddForm.
 */

export const NEW_RELATIONSHIP_FORM_ID = "new-relationship-panel"

export const NEW_RELATIONSHIP_ENTRY_POINTS = {
  interview: "interview-relationships",
  clientBackground: "client-background-relationships",
} as const

export type NewRelationshipEntryPoint = keyof typeof NEW_RELATIONSHIP_ENTRY_POINTS

/** Both surfaces resolve to the same form id. */
export function newRelationshipFormIdForEntryPoint(
  entry: NewRelationshipEntryPoint
): typeof NEW_RELATIONSHIP_FORM_ID {
  void entry
  return NEW_RELATIONSHIP_FORM_ID
}
