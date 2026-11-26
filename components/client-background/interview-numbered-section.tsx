"use client"

import type { ReactNode } from "react"

import { SectionNumberBadge, SectionStatusPill } from "@/components/shared/section-status-pill"
import type { SectionStatus } from "@/lib/section-status"
import { cn } from "@/lib/utils"

export function InterviewNumberedSection({
  section,
  open,
  onToggle,
  children,
}: {
  section: SectionStatus
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section id={`interview-section-${section.letter}`} className="scroll-mt-36 rounded-lg border">
      <h2>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          aria-expanded={open}
          onClick={onToggle}
        >
          <SectionNumberBadge
            section={section}
            className="rounded-md border-neutral-900 bg-neutral-900 text-white"
          />
          <span className="flex-1 text-sm font-semibold">{section.title}</span>
          <SectionStatusPill section={section} />
          <span className="text-muted-foreground" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </button>
      </h2>
      <div className={cn("space-y-4 border-t px-4 py-4", !open && "hidden")}>{children}</div>
    </section>
  )
}
