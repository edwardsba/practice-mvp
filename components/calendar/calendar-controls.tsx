import Link from "next/link"

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["day", "week", "month"] as CalendarView[]).map((option) => {
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

      <p className="text-sm font-medium text-muted-foreground">
        {formatCalendarPeriodLabel(view, anchorDate)}
      </p>
    </div>
  )
}
