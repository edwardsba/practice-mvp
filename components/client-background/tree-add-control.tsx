"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Plus } from "lucide-react"

import {
  treeItemStateClassName,
  treeLayer2ShellClassName,
  treeLayer3ShellClassName,
  treeLayer4ShellClassName,
  treeLayerBarElementStyle,
  treeLayerOuterStyle,
} from "@/components/client-background/tree-levels"
import type { TreeAddChoice } from "@/lib/client-background/tree-add"
import { cn } from "@/lib/utils"

/**
 * Round ⊕ on a tree line. One choice → opens immediately; several → shows a
 * choice row under the line. Shared by relationship and history trees.
 *
 * The choice menu closes on select, outside tap/click, or Escape — otherwise
 * it sticks open on mobile after ⊕ (Round AP.2 follow-up).
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
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation()
        setOpen(false)
      }
    }

    // Pointer down (not click) so iOS Safari dismisses before another control
    // steals the gesture; capture so a parent stopPropagation cannot block us.
    document.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

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
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={choices.length > 1 ? open : undefined}
        aria-controls={choices.length > 1 && open ? listId : undefined}
        className="inline-flex size-11 items-center justify-center rounded-full border border-input bg-background text-foreground hover:bg-zinc-100"
        onClick={handlePlusClick}
      >
        <Plus className="size-5" aria-hidden />
      </button>
      {open && choices.length > 1 ? (
        <TreeAddChoiceRow
          id={listId}
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
  id,
  choices,
  onSelect,
}: {
  id?: string
  choices: TreeAddChoice[]
  onSelect: (choiceId: string) => void
}) {
  return (
    <div
      id={id}
      role="menu"
      className="absolute top-full right-0 z-10 mt-1 flex flex-wrap justify-end gap-1.5 rounded-lg border border-border bg-background p-1.5 shadow-sm"
      onClick={(event) => event.stopPropagation()}
    >
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          role="menuitem"
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
 * Full-width tree line: straight left bar + content (tap opens panel) + optional ⊕.
 * Hover/selected fill sits inside the bar and never bends it.
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
  const showAdd = Boolean(addChoices && addChoices.length > 0 && onAdd)

  const fill = interactive && onOpen ? (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      className={cn("min-w-0 flex-1", shell, treeItemStateClassName({ selected }))}
      onClick={onOpen}
    >
      {children}
    </button>
  ) : (
    <div
      className={cn(
        "min-w-0 flex-1",
        shell,
        treeItemStateClassName({ interactive: false, selected })
      )}
    >
      {children}
    </div>
  )

  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0 flex-1" style={treeLayerOuterStyle(layer)}>
        <span aria-hidden style={treeLayerBarElementStyle(layer)} />
        {fill}
      </div>
      {showAdd ? (
        <TreeAddControl choices={addChoices!} onSelect={onAdd!} aria-label={addAriaLabel} />
      ) : null}
    </div>
  )
}
