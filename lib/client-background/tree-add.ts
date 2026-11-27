import type { BlockKind } from "@/lib/client-background/types"
import { treeBarColours } from "@/lib/ui/status-colours"

/** One choice shown under ⊕ (or opened immediately when alone). */
export type TreeAddChoice = {
  id: string
  label: string
}

export type RelationshipAddLineKind =
  | { type: "heading"; section: "relationship" | "arrangement" | "other_children" }
  | { type: "block"; blockKind: BlockKind }

export type HistoryAddLineKind =
  | { type: "heading"; mode: "condition" | "event" }
  | { type: "issue" }
  | { type: "nestable_event" }

/**
 * ⊕ choices for a relationship tree line.
 * Returns null when the line cannot hold anything under it.
 */
export function relationshipTreeAddChoices(line: RelationshipAddLineKind): TreeAddChoice[] | null {
  if (line.type === "heading") {
    if (line.section === "arrangement") {
      return [{ id: "arrangement", label: "Arrangement" }]
    }
    if (line.section === "other_children") {
      return [{ id: "relationship", label: "Relationship" }]
    }
    return [{ id: "relationship", label: "Relationship" }]
  }
  return addChoicesForBlockKind(line.blockKind)
}

/**
 * ⊕ choices for a history tree line.
 * Returns null when the line cannot hold anything under it.
 */
export function historyTreeAddChoices(line: HistoryAddLineKind): TreeAddChoice[] | null {
  if (line.type === "heading") {
    if (line.mode === "condition") {
      return [{ id: "issue", label: "Issue" }]
    }
    return [{ id: "event", label: "Event" }]
  }
  if (line.type === "issue") {
    return [
      { id: "episode", label: "Episode" },
      { id: "treatment", label: "Treatment" },
      { id: "other", label: "Other event" },
    ]
  }
  if (line.type === "nestable_event") {
    return [{ id: "event", label: "Event" }]
  }
  return null
}

/** Roles offered by ⊕ on a relationship / arrangement line. */
export function addChoicesForBlockKind(kind: BlockKind): TreeAddChoice[] | null {
  if (kind === "client_current" || kind === "client_previous") {
    return [
      { id: "partner", label: "Partner" },
      { id: "child", label: "Child" },
    ]
  }
  if (kind === "parent_other") {
    return [
      { id: "partner", label: "Partner" },
      { id: "sibling", label: "Sibling" },
    ]
  }
  if (kind === "biological_parents") {
    return [{ id: "sibling", label: "Sibling" }]
  }
  if (kind === "caregiver_arrangement") {
    return [
      { id: "caregiver", label: "Caregiver" },
      { id: "sibling", label: "Sibling" },
    ]
  }
  if (kind === "client_other_children") {
    return [{ id: "child", label: "Child" }]
  }
  return null
}

export type TreeBarStyle = {
  widthPx: number
  color: string
  /** Indent from the tree’s left edge to the bar. */
  indentPx: number
}

/**
 * Level → left-bar style. Level 1 (heading) has no bar.
 */
export function treeBarStyle(layer: 1 | 2 | 3 | 4): TreeBarStyle | null {
  if (layer === 1) return null
  if (layer === 2) {
    return { widthPx: 4, color: treeBarColours.dark, indentPx: 0 }
  }
  if (layer === 3) {
    return { widthPx: 2, color: treeBarColours.mid, indentPx: 18 }
  }
  return { widthPx: 2, color: treeBarColours.light, indentPx: 38 }
}
