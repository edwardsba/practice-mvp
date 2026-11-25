/**
 * Pure rules for shared-form section badges and headers.
 *
 * - group_label starting with "X. " (single letter + ". ") → letter badge, title after prefix
 * - otherwise → numbered badges (1, 2, 3, …) and the full group_label as the header
 * - no group_label at all → one ungrouped section; caller hides the progress bar
 */

/** Synthetic group key when every element has a null group_label. */
export const UNGROUPED_SECTION_KEY = ""

const LETTER_PREFIX = /^[A-Za-z]\. /

export function hasLetterSectionPrefix(groupLabel: string): boolean {
  return LETTER_PREFIX.test(groupLabel)
}

export type PresentedSectionLabel = {
  /** Original group_label, or UNGROUPED_SECTION_KEY when none. */
  groupLabel: string
  /** Progress / badge text: "A" or "1". */
  badge: string
  /** Section header text. */
  title: string
}

export type SectionPresentation = {
  showProgressBar: boolean
  sections: PresentedSectionLabel[]
}

/**
 * Present ordered unique group labels for the progress bar and section headers.
 * Pass an empty array when the assessment has no group_label values at all.
 */
export function presentSectionLabels(
  orderedGroupLabels: string[]
): SectionPresentation {
  if (orderedGroupLabels.length === 0) {
    return {
      showProgressBar: false,
      sections: [
        {
          groupLabel: UNGROUPED_SECTION_KEY,
          badge: "1",
          title: "",
        },
      ],
    }
  }

  const sections = orderedGroupLabels.map((groupLabel, index) => {
    if (hasLetterSectionPrefix(groupLabel)) {
      const dot = groupLabel.indexOf(".")
      return {
        groupLabel,
        badge: groupLabel.slice(0, dot).trim(),
        title: groupLabel.slice(dot + 1).trim(),
      }
    }
    return {
      groupLabel,
      badge: String(index + 1),
      title: groupLabel,
    }
  })

  return { showProgressBar: true, sections }
}
