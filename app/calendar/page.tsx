import Link from "next/link"

import { CalendarControls } from "@/components/calendar/calendar-controls"
import { CalendarMonthView } from "@/components/calendar/calendar-month-view"
import { CalendarTimedGrid } from "@/components/calendar/calendar-timed-grid"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { loadAppointmentsForPractitionerInRange } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import {
  getCalendarLoadRange,
  getWeekDays,
  parseAnchorDate,
  parseCalendarView,
} from "@/lib/calendar/dates"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const { view: viewParam, date: dateParam } = await searchParams
  const context = await requirePractitionerContext()
  const view = parseCalendarView(viewParam)
  const anchorDate = parseAnchorDate(dateParam)
  const { start, end } = getCalendarLoadRange(view, anchorDate)

  const appointments = await loadAppointmentsForPractitionerInRange(
    context.practiceId,
    context.practitionerProfileId,
    start,
    end
  )

  const timedDays =
    view === "day" ? [anchorDate] : view === "week" ? getWeekDays(anchorDate) : []

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <Button asChild>
          <Link href="/appointments/new">New Appointment</Link>
        </Button>
      </div>

      <div className="mb-6">
        <CalendarControls view={view} anchorDate={anchorDate} />
      </div>

      {view === "month" ? (
        <CalendarMonthView
          anchorDate={anchorDate}
          appointments={appointments}
        />
      ) : (
        <CalendarTimedGrid days={timedDays} appointments={appointments} />
      )}
    </AppShell>
  )
}
