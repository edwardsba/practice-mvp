import {
  sectionProgressClass,
  statusPillLabel,
  type SectionStatus,
} from "@/lib/section-status"
import { statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

export function SectionNumberBadge({
  section,
  className,
}: {
  section: Pick<SectionStatus, "letter" | "status">
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border text-sm font-semibold",
        sectionProgressClass(section),
        className
      )}
    >
      {section.letter}
    </span>
  )
}

export function SectionStatusPill({
  section,
  className,
}: {
  section: Pick<SectionStatus, "status" | "left" | "toConfirm" | "hasDefaults">
  className?: string
}) {
  const tone =
    section.status === "not_started"
      ? statusColours.neutral.text
      : section.status === "left" || section.status === "to_confirm"
        ? statusColours.attention.text
        : section.status === "done"
          ? statusColours.done.text
          : "text-muted-foreground"
  return <span className={cn("text-xs font-medium", tone, className)}>{statusPillLabel(section)}</span>
}
