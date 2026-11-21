"use client"

import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function InterviewSectionCard({
  id,
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  id?: string
  title: string
  open: boolean
  onToggle: () => void
  badge?: string
  children: ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-28">
      <CardHeader>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
          onClick={onToggle}
        >
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {badge ? <p className="mt-1 text-xs text-muted-foreground">{badge}</p> : null}
          </div>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CardHeader>
      <CardContent className={cn("min-w-0", !open && "hidden")}>{children}</CardContent>
    </Card>
  )
}

export function sectionOpenStorageKey(clientId: string, page: "background" | "history"): string {
  return `background-interview-sections:${clientId}:${page}`
}

export function readSectionOpenState(clientId: string, page: "background" | "history"): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(sectionOpenStorageKey(clientId, page))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, boolean>
  } catch {
    return {}
  }
}

export function writeSectionOpenState(
  clientId: string,
  page: "background" | "history",
  state: Record<string, boolean>
): void {
  try {
    sessionStorage.setItem(sectionOpenStorageKey(clientId, page), JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}

export function needsBadge(count: number): string {
  return count > 0 ? `Needs ${count}` : "Complete"
}
