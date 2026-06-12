import Link from "next/link"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  buildCalendarUrl,
  formatCalendarPeriodLabel,
  shiftAnchorDate,
  type CalendarView,
} from "@/lib/calendar/dates"
import { todayDateString } from "@/lib/appointments/format"
import { cn } from "@/lib/utils"

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
}

const VIEW_OPTIONS: CalendarView[] = ["day", "week", "month"]

export function CalendarControls({
  view,
  anchorDate,
}: {
  view: CalendarView
  anchorDate: string
}) {
  const previousDate = shiftAnchorDate(anchorDate, view, -1)
  const nextDate = shiftAnchorDate(anchorDate, view, 1)
  const today = todayDateString()
  const periodLabel = formatCalendarPeriodLabel(view, anchorDate)

  return (
    <>
      <div className="space-y-2 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium">{periodLabel}</p>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="icon-sm" asChild>
              <Link
                href={buildCalendarUrl(view, previousDate)}
                aria-label="Previous period"
              >
                <ChevronLeft />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildCalendarUrl(view, today)}>Today</Link>
            </Button>
            <Button variant="outline" size="icon-sm" asChild>
              <Link
                href={buildCalendarUrl(view, nextDate)}
                aria-label="Next period"
              >
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            {VIEW_OPTIONS.map((option) => {
              const isActive = view === option
              return (
                <Link
                  key={option}
                  href={buildCalendarUrl(option, anchorDate)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {VIEW_LABELS[option]}
                </Link>
              )
            })}
          </div>
          <Button size="icon-sm" asChild>
            <Link
              href="/appointments/new?returnTo=/calendar"
              aria-label="New appointment"
            >
              <Plus />
            </Link>
          </Button>
        </div>
      </div>

      <div className="hidden space-y-4 sm:block">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => {
              const isActive = view === option
              return (
                <Button
                  key={option}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  asChild
                  className={cn(!isActive && "bg-background")}
                >
                  <Link href={buildCalendarUrl(option, anchorDate)}>
                    {VIEW_LABELS[option]}
                  </Link>
                </Button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={buildCalendarUrl(view, previousDate)}>Previous</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildCalendarUrl(view, today)}>Today</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildCalendarUrl(view, nextDate)}>Next</Link>
            </Button>
          </div>
        </div>

        <p className="text-sm font-medium text-muted-foreground">{periodLabel}</p>
      </div>
    </>
  )
}
