"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  APPOINTMENT_FILTER_VALUES,
  type AppointmentFilter,
} from "@/lib/appointments/constants"
import { cn } from "@/lib/utils"

const FILTER_LABELS: Record<AppointmentFilter, string> = {
  upcoming: "Upcoming",
  past: "Past",
  all: "All",
}

export function AppointmentsFilter({
  currentFilter,
}: {
  currentFilter: AppointmentFilter
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2">
      {APPOINTMENT_FILTER_VALUES.map((filter) => {
        const isActive = currentFilter === filter
        const href =
          filter === "all" ? pathname : `${pathname}?filter=${filter}`

        return (
          <Button
            key={filter}
            variant={isActive ? "default" : "outline"}
            size="sm"
            asChild
            className={cn(!isActive && "bg-background")}
          >
            <Link href={href}>{FILTER_LABELS[filter]}</Link>
          </Button>
        )
      })}
    </div>
  )
}
