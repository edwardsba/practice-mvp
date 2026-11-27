/**
 * Shared section/item status helpers for the assessment form and Background interview.
 * Pure — no database, no UI.
 */

import { statusColours } from "@/lib/ui/status-colours"

export type SectionStatusKind = "skipped" | "left" | "to_confirm" | "done"

export type SectionStatus = {
  groupLabel: string
  letter: string
  title: string
  status: SectionStatusKind
  /** Unanswered required questions (or required groups) still left. */
  left: number
  /** Pre-filled answers the practitioner has not yet confirmed. */
  toConfirm: number
  /**
   * True when any element in the section has a default-selection option
   * (used for "Confirmed" vs "Complete" done wording).
   */
  hasDefaults: boolean
}

export type ItemStatusKind = "left" | "to_confirm" | "done"

/** One answered/unanswered item for aggregateSectionStatus. */
export type StatusItem = {
  /** False when the item has no value yet. */
  hasValue: boolean
  /** False when the value is carried over and not yet tapped. */
  confirmed: boolean
}

export function itemStatus(item: StatusItem): ItemStatusKind {
  if (!item.hasValue) return "left"
  if (!item.confirmed) return "to_confirm"
  return "done"
}

/**
 * Precedence: any left → left; else any to_confirm → to_confirm; else done.
 * Empty sections with no items are done (interview) — callers pass skipped separately.
 */
export function aggregateSectionStatus(
  items: readonly StatusItem[],
  options?: { hasDefaults?: boolean }
): Pick<SectionStatus, "status" | "left" | "toConfirm" | "hasDefaults"> {
  let left = 0
  let toConfirm = 0
  for (const item of items) {
    const status = itemStatus(item)
    if (status === "left") left += 1
    else if (status === "to_confirm") toConfirm += 1
  }
  if (left > 0) {
    return { status: "left", left, toConfirm: 0, hasDefaults: Boolean(options?.hasDefaults) }
  }
  if (toConfirm > 0) {
    return { status: "to_confirm", left: 0, toConfirm, hasDefaults: Boolean(options?.hasDefaults) }
  }
  return { status: "done", left: 0, toConfirm: 0, hasDefaults: Boolean(options?.hasDefaults) }
}

/** Short pill text for a section header. */
export function statusPillLabel(section: Pick<SectionStatus, "status" | "left" | "toConfirm" | "hasDefaults">): string {
  if (section.status === "skipped") return "Skipped"
  if (section.status === "left") return `${section.left} left`
  if (section.status === "to_confirm") return `${section.toConfirm} to confirm`
  if (section.hasDefaults) return "Confirmed"
  return "Done"
}

/**
 * Full status string for a progress chip's aria-label / title
 * (chips themselves show only the badge).
 * e.g. "Section 1, Presentation: 5 to confirm"
 *      "Section C, Risk factors: skipped"
 */
export function progressChipAriaLabel(section: SectionStatus): string {
  let detail: string
  switch (section.status) {
    case "skipped":
      detail = "skipped"
      break
    case "left":
      detail = `${section.left} to answer`
      break
    case "to_confirm":
      detail = `${section.toConfirm} to confirm`
      break
    case "done":
      detail = section.hasDefaults ? "confirmed" : "complete"
      break
  }
  return `Section ${section.letter}, ${section.title}: ${detail}`
}

/** Tailwind classes for chip / number badge colour by status. */
export function sectionProgressClass(section: Pick<SectionStatus, "status">): string {
  if (section.status === "done") {
    return statusColours.done.chip
  }
  if (section.status === "left") {
    return statusColours.neutral.chip
  }
  if (section.status === "to_confirm") {
    return statusColours.attention.chip
  }
  return "border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground"
}
