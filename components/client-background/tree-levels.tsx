"use client"

import type { CSSProperties, ReactNode } from "react"

import { treeBarStyle } from "@/lib/client-background/tree-add"
import {
  treeBarColours,
  treeSelectedSurfaceClass,
  treeSelectedTitleClass,
} from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

/** Visual layers shared by History and Relationships trees. */
export type TreeLayer = 1 | 2 | 3 | 4

/** @deprecated Corner connectors removed — left bars live on each line shell. */
export function treeConnectorStyle(
  intoLayer: 2 | 3 | 4,
  _options?: { dashed?: boolean }
): { vertical: { borderLeft: string; width: number }; elbow: { borderTop: string; height: number; width: number } } {
  const bar = treeBarStyle(intoLayer)!
  const border = `${bar.widthPx}px solid ${bar.color}`
  return {
    vertical: { borderLeft: border, width: 0 },
    elbow: { borderTop: border, height: 0, width: 0 },
  }
}

export const treeLayer1ClassName = "text-[15px] font-bold text-zinc-900"

/**
 * Indent + space for the straight left bar. The bar itself is a separate
 * square-edged element so hover/selected fills never bend it.
 */
export function treeLayerOuterStyle(layer: 2 | 3 | 4): CSSProperties {
  const bar = treeBarStyle(layer)!
  return {
    marginLeft: bar.indentPx,
    paddingLeft: bar.widthPx,
    position: "relative",
    boxSizing: "border-box",
  }
}

export function treeLayerBarElementStyle(layer: 2 | 3 | 4): CSSProperties {
  const bar = treeBarStyle(layer)!
  return {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: bar.widthPx,
    backgroundColor: bar.color,
    borderRadius: 0,
  }
}

/** @deprecated Prefer treeLayerOuterStyle + bar element. */
export function treeLayerBarStyle(layer: 2 | 3 | 4): CSSProperties {
  return treeLayerOuterStyle(layer)
}

function shellBase(_layer: 2 | 3 | 4): string {
  return cn("flex min-h-11 w-full flex-col justify-center px-3 py-[7px] text-left")
}

export const treeLayer2ShellClassName = shellBase(2)
export const treeLayer2TitleClassName = "text-base font-semibold"
export const treeLayer2MetaClassName = "text-[13px] text-zinc-600"

export const treeLayer3ShellClassName = shellBase(3)
export const treeLayer3TitleClassName = "text-[15px] font-medium"
export const treeLayer3MetaClassName = "text-[13px] text-zinc-600"
export const treeLayer3AvatarClassName =
  "flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-medium"

export const treeLayer4ShellClassName = shellBase(4)
export const treeLayer4TitleClassName = "text-sm font-normal text-zinc-700"
export const treeLayer4MetaClassName = "text-[13px] text-zinc-600"
export const treeLayer4AvatarClassName =
  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"

/** Small grey tag for event types (Episode / Treatment / Other / Step). */
export const treeEventTagClassName =
  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-zinc-100 text-zinc-600"

/**
 * Hover / selected fills. Soft corners sit on the fill only — the left bar is a
 * separate square element outside this class.
 */
export function treeItemStateClassName(options: {
  selected?: boolean
  interactive?: boolean
  /** Ignored — fills are always soft on the right only; bar stays square. */
  square?: boolean
}): string {
  void options.square
  return cn(
    "rounded-r-md rounded-l-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    options.interactive !== false && "hover:bg-zinc-100",
    options.selected && treeSelectedSurfaceClass
  )
}

export function treeSelectedTitleClassName(selected?: boolean): string {
  return selected ? treeSelectedTitleClass : ""
}

/** Compact inline Yes / No / Not asked (and similar) on a tree row. */
export function TreeInlineSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  children: ReactNode
  className?: string
  "aria-label"?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {label ? (
        <label htmlFor={id} className="text-[13px] font-medium text-zinc-900">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        aria-label={ariaLabel ?? label}
        className={cn(
          "h-9 w-[140px] shrink-0 rounded-lg border border-input bg-transparent px-2.5 text-base shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:text-sm",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  )
}

/**
 * List item wrapper for a tree child. No corner connectors — the line’s own
 * left bar is the visual hierarchy.
 */
export function TreeBranch({
  intoLayer,
  isLast: _isLast,
  dashed: _dashed,
  children,
}: {
  intoLayer: 2 | 3 | 4
  isLast: boolean
  dashed?: boolean
  children: ReactNode
}) {
  void _isLast
  void _dashed
  void intoLayer
  return <li className="relative list-none">{children}</li>
}

/** Re-export bar colour tokens for callers that need the hex values. */
export { treeBarColours }
