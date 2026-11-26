import {
  sectionProgressClass,
  statusPillLabel,
  type SectionStatus,
} from "@/lib/section-status"
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
    section.status === "left"
      ? "text-orange-800"
      : section.status === "to_confirm"
        ? "text-amber-800"
        : section.status === "done"
          ? "text-emerald-800"
          : "text-muted-foreground"
  return <span className={cn("text-xs font-medium", tone, className)}>{statusPillLabel(section)}</span>
}
