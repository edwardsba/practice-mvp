"use client"

import { Plus } from "lucide-react"

import {
  addToRelationshipMenuHeading,
  addToRelationshipMenuOptions,
} from "@/lib/client-background/add-to-relationship"
import type { BlockKind, BlockRole, RelationshipBlock } from "@/lib/client-background/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Round + on a relationship line. Opens Partner/Child (intimate) or
 * Partner/Sibling (parents' other). One shared component for Background + Interview.
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Add to this relationship"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-input bg-background text-foreground hover:bg-muted",
            className
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {addToRelationshipMenuHeading(block)}
        </DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.role}
            onSelect={() => onSelect(option.role)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
