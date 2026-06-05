"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  SESSION_NOTE_FILTER_VALUES,
  type SessionNoteFilter,
} from "@/lib/session-notes/constants"
import { cn } from "@/lib/utils"

const FILTER_LABELS: Record<SessionNoteFilter, string> = {
  all: "All",
  draft: "Draft",
  finalised: "Finalised",
}

export function SessionNotesFilter({
  currentFilter,
  clientId,
}: {
  currentFilter: SessionNoteFilter
  clientId?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function buildHref(filter: SessionNoteFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === "all") {
      params.delete("filter")
    } else {
      params.set("filter", filter)
    }
    if (clientId) {
      params.set("client_id", clientId)
    }
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SESSION_NOTE_FILTER_VALUES.map((filter) => {
        const isActive = currentFilter === filter
        return (
          <Button
            key={filter}
            variant={isActive ? "default" : "outline"}
            size="sm"
            asChild
            className={cn(!isActive && "bg-background")}
          >
            <Link href={buildHref(filter)}>{FILTER_LABELS[filter]}</Link>
          </Button>
        )
      })}
    </div>
  )
}
