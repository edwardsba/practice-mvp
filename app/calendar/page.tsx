import Link from "next/link"

import { getPractitionerProfile } from "@/app/practitioner/actions"
import { CalendarControls } from "@/components/calendar/calendar-controls"
import { CalendarMonthView } from "@/components/calendar/calendar-month-view"
import { CalendarTimedGrid } from "@/components/calendar/calendar-timed-grid"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { getMemberships } from "@/lib/actions/practitioner-practice"
import { loadAppointmentsForPractitionerInRange } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import {
  getCalendarLoadRange,
  getWeekDays,
  parseAnchorDate,
  parseCalendarView,
} from "@/lib/calendar/dates"
import { formatTimeForInput } from "@/lib/calendar/time-slots"

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

  const [appointments, profile, memberships] = await Promise.all([
    loadAppointmentsForPractitionerInRange(
      context.practiceId,
      context.practitionerProfileId,
      start,
      end
    ),
    getPractitionerProfile(),
    getMemberships(context.practitionerProfileId),
  ])

  const calendarSettings = {
    startTime: formatTimeForInput(profile?.calendarStartTime ?? "07:00:00"),
    endTime: formatTimeForInput(profile?.calendarEndTime ?? "20:00:00"),
    intervalMinutes: profile?.calendarIntervalMinutes ?? 30,
  }

  const availabilityBlocks = memberships.flatMap((membership) =>
    membership.availabilityBlocks.map((block) => ({
      dayOfWeek: block.dayOfWeek,
      startTime: String(block.startTime),
      endTime: String(block.endTime),
      mode: block.mode,
    }))
  )

  const timedDays =
    view === "day" ? [anchorDate] : view === "week" ? getWeekDays(anchorDate) : []

  return (
    <AppShell>
      <div className="mb-6 hidden sm:flex sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <Button asChild>
          <Link href="/appointments/new?returnTo=/calendar">
            New Appointment
          </Link>
        </Button>
      </div>

      <div className="mb-4 sm:mb-6">
        <CalendarControls view={view} anchorDate={anchorDate} />
      </div>

      {view === "month" ? (
        <CalendarMonthView
          anchorDate={anchorDate}
          appointments={appointments}
        />
      ) : (
        <CalendarTimedGrid
          days={timedDays}
          appointments={appointments}
          calendarSettings={calendarSettings}
          availabilityBlocks={availabilityBlocks}
        />
      )}
    </AppShell>
  )
}
