"use client"

import {
  progressChipAriaLabel,
  sectionProgressClass,
  type SectionStatus,
} from "@/lib/section-status"
import { cn } from "@/lib/utils"

export function SectionProgressChips({
  sections,
  onSelect,
  className,
}: {
  sections: SectionStatus[]
  onSelect: (section: SectionStatus) => void
  className?: string
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      {sections.map((section) => {
        const chipLabel = progressChipAriaLabel(section)
        return (
          <button
            key={section.groupLabel}
            type="button"
            onClick={() => onSelect(section)}
            className={cn(
              "flex h-11 min-h-11 flex-1 items-center justify-center rounded-md border px-1 text-sm font-semibold",
              sectionProgressClass(section)
            )}
            aria-label={chipLabel}
            title={chipLabel}
          >
            {section.letter}
          </button>
        )
      })}
    </div>
  )
}
