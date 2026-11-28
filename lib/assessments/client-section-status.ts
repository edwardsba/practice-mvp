import type { SectionStatus } from "@/lib/section-status"

/**
 * Client-form progress chips (CP-2 / visit-based).
 * Nothing in the self-report is required, so "done" cannot mean "all required answered".
 *
 * - not_started (neutral): not opened yet
 * - left (attention): the section you're on, or visited with a required question unanswered
 * - done (green): opened and moved on (Next / chip), with no required unanswered
 * - skipped: unchanged
 */
export function applyClientVisitSectionStatuses(
  sections: SectionStatus[],
  params: {
    currentGroupLabel: string | null
    visitedGroupLabels: ReadonlySet<string>
  }
): SectionStatus[] {
  return sections.map((section) => {
    if (section.status === "skipped") return section

    const isCurrent = section.groupLabel === params.currentGroupLabel
    const visited = params.visitedGroupLabels.has(section.groupLabel)

    if (section.left > 0) {
      return {
        ...section,
        status: "left" as const,
        toConfirm: 0,
      }
    }

    if (isCurrent) {
      return {
        ...section,
        status: "left" as const,
        left: 0,
        toConfirm: 0,
      }
    }

    if (visited) {
      return {
        ...section,
        status: "done" as const,
        left: 0,
        toConfirm: 0,
      }
    }

    return {
      ...section,
      status: "not_started" as const,
      left: 0,
      toConfirm: 0,
    }
  })
}
