"use client"

import { TreeAddControl } from "@/components/client-background/tree-add-control"
import { addToRelationshipMenuOptions } from "@/lib/client-background/add-to-relationship"
import type { BlockKind, BlockRole, RelationshipBlock } from "@/lib/client-background/types"

/**
 * ⊕ on a relationship line. Opens Partner/Child (intimate), Partner/Sibling
 * (parents' other), Sibling (biological), Caregiver/Sibling (arrangement), or
 * Child (other children). One shared control for Background + Interview.
 */
export function AddToRelationshipMenu({
  block,
  onSelect,
  className,
}: {
  block: Pick<RelationshipBlock, "kind" | "status" | "startedOn" | "endedOn">
  onSelect: (role: BlockRole) => void
  className?: string
}) {
  const options = addToRelationshipMenuOptions(block.kind as BlockKind)
  if (options.length === 0) return null
  return (
    <TreeAddControl
      className={className}
      aria-label="Add to this relationship"
      choices={options.map((option) => ({ id: option.role, label: option.label }))}
      onSelect={(id) => onSelect(id as BlockRole)}
    />
  )
}
