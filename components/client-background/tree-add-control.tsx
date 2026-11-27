"use client"

import { useState, type ReactNode } from "react"
import { Plus } from "lucide-react"

import {
  treeItemStateClassName,
  treeLayer2ShellClassName,
  treeLayer3ShellClassName,
  treeLayer4ShellClassName,
  treeLayerBarStyle,
} from "@/components/client-background/tree-levels"
import type { TreeAddChoice } from "@/lib/client-background/tree-add"
import { cn } from "@/lib/utils"

/**
 * Round ⊕ on a tree line. One choice → opens immediately; several → shows a
 * choice row under the line. Shared by relationship and history trees.
 */
export function TreeAddControl({
  choices,
  onSelect,
  "aria-label": ariaLabel = "Add",
  className,
}: {
  choices: TreeAddChoice[]
  onSelect: (choiceId: string) => void
  "aria-label"?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (choices.length === 0) return null

  function handlePlusClick(event: React.MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
    if (choices.length === 1) {
      onSelect(choices[0]!.id)
      setOpen(false)
      return
    }
    setOpen((prev) => !prev)
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={choices.length > 1 ? open : undefined}
        className="inline-flex size-11 items-center justify-center rounded-full border border-input bg-background text-foreground hover:bg-zinc-100"
        onClick={handlePlusClick}
      >
        <Plus className="size-5" aria-hidden />
      </button>
      {open && choices.length > 1 ? (
        <TreeAddChoiceRow
          choices={choices}
          onSelect={(id) => {
            setOpen(false)
            onSelect(id)
          }}
        />
      ) : null}
    </div>
  )
}

/** Row of small round-edged choice buttons under a tree line. */
export function TreeAddChoiceRow({
  choices,
  onSelect,
}: {
  choices: TreeAddChoice[]
  onSelect: (choiceId: string) => void
}) {
  return (
    <div
      className="absolute top-full right-0 z-10 mt-1 flex flex-wrap justify-end gap-1.5 rounded-lg border border-border bg-background p-1.5 shadow-sm"
      onClick={(event) => event.stopPropagation()}
    >
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          className="inline-flex min-h-9 items-center rounded-full border border-input bg-background px-3 text-sm hover:bg-zinc-100"
          onClick={() => onSelect(choice.id)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Full-width tree line: left-bar content (tap opens panel) + optional ⊕ on the right.
 */
export function TreeLineRow({
  layer,
  selected,
  interactive = true,
  onOpen,
  addChoices,
  onAdd,
  addAriaLabel,
  children,
}: {
  layer: 2 | 3 | 4
  selected?: boolean
  interactive?: boolean
  onOpen?: () => void
  addChoices?: TreeAddChoice[] | null
  onAdd?: (choiceId: string) => void
  addAriaLabel?: string
  children: ReactNode
}) {
  const shell =
    layer === 2 ? treeLayer2ShellClassName : layer === 3 ? treeLayer3ShellClassName : treeLayer4ShellClassName
  const barStyle = treeLayerBarStyle(layer)
  const showAdd = Boolean(addChoices && addChoices.length > 0 && onAdd)

  const body =
    interactive && onOpen ? (
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        className={cn("min-w-0 flex-1", shell, treeItemStateClassName({ selected, square: layer === 2 }))}
        style={barStyle}
        onClick={onOpen}
      >
        {children}
      </button>
    ) : (
      <div
        className={cn(
          "min-w-0 flex-1",
          shell,
          treeItemStateClassName({ interactive: false, square: layer === 2, selected })
        )}
        style={barStyle}
      >
        {children}
      </div>
    )

  return (
    <div className="flex items-start gap-1">
      {body}
      {showAdd ? (
        <TreeAddControl choices={addChoices!} onSelect={onAdd!} aria-label={addAriaLabel} />
      ) : null}
    </div>
  )
}
