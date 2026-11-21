"use client"

import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Visual layers shared by History and Relationships trees (board AD). */
export type TreeLayer = 1 | 2 | 3 | 4

export const TREE_INDENT_CLASS = "pl-4"

const CONNECTOR = {
  2: { thickness: 2.5, color: "#334155", dashed: false },
  3: { thickness: 2, color: "#7c8aa0", dashed: false },
  4: { thickness: 1.5, color: "#b8c1cf", dashed: false },
} as const

export function treeConnectorStyle(
  intoLayer: 2 | 3 | 4,
  options?: { dashed?: boolean }
): { vertical: CSSProperties; elbow: CSSProperties } {
  const spec = CONNECTOR[intoLayer]
  const dashed = options?.dashed ?? spec.dashed
  const border = `${spec.thickness}px ${dashed ? "dashed" : "solid"} ${spec.color}`
  return {
    vertical: {
      borderLeft: border,
      width: 0,
    },
    elbow: {
      borderTop: border,
      height: 0,
      width: 16,
    },
  }
}

export const treeLayer1ClassName = "text-[15px] font-bold text-zinc-900"

/** Square corners so the 4px left bar stays a straight vertical line (board AD). */
export const treeLayer2ShellClassName =
  "flex min-h-[44px] w-full flex-col justify-center rounded-none border-l-4 border-[#334155] bg-transparent px-3 py-[7px] text-left"

export const treeLayer2TitleClassName = "text-[14.5px] font-semibold"
export const treeLayer2MetaClassName = "text-[12.5px] text-zinc-600"

export const treeLayer3ShellClassName =
  "flex min-h-[44px] w-full flex-col justify-center px-1 py-1 text-left"
export const treeLayer3TitleClassName = "text-sm font-medium"
export const treeLayer3MetaClassName = "text-[12.5px] text-zinc-600"
export const treeLayer3AvatarClassName =
  "flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-medium"

export const treeLayer4ShellClassName =
  "flex min-h-10 w-full flex-col justify-center px-1 py-1 text-left"
export const treeLayer4TitleClassName = "text-[13px] font-normal text-zinc-700"
export const treeLayer4MetaClassName = "text-xs text-zinc-600"
export const treeLayer4AvatarClassName =
  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"

/** Hover / selected backgrounds — the only fills used in a tree. */
export function treeItemStateClassName(options: {
  selected?: boolean
  interactive?: boolean
  /** Layer-2: square fills so the left bar is not bent into a curve. */
  square?: boolean
}): string {
  return cn(
    options.square
      ? "rounded-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      : "rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    options.interactive !== false && "hover:bg-zinc-100",
    options.selected && "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#dbeafe]"
  )
}

export function treeSelectedTitleClassName(selected?: boolean): string {
  return selected ? "text-[#1e3a8a]" : ""
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

/** Elbow connector wrapping one child of a connected list. */
export function TreeBranch({
  intoLayer,
  isLast,
  dashed,
  children,
}: {
  intoLayer: 2 | 3 | 4
  isLast: boolean
  dashed?: boolean
  children: ReactNode
}) {
  const style = treeConnectorStyle(intoLayer, { dashed })
  return (
    <li className={cn("relative", TREE_INDENT_CLASS)}>
      <span
        aria-hidden
        className="absolute top-0 left-0"
        style={{
          ...style.vertical,
          height: isLast ? 22 : "100%",
        }}
      />
      <span aria-hidden className="absolute top-[22px] left-0" style={style.elbow} />
      {children}
    </li>
  )
}
