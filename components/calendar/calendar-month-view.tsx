import Link from "next/link"

import {
  buildCalendarUrl,
  getMonthGridDays,
  newAppointmentUrl,
  parseDateString,
} from "@/lib/calendar/dates"
import {
  formatAppointmentClientName,
  groupAppointmentsByDate,
} from "@/lib/calendar/time-slots"
import type { CalendarAppointment } from "@/lib/appointments/load"
import { todayDateString } from "@/lib/appointments/format"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const WEEKDAY_LABELS_SHORT = ["M", "Tu", "W", "Th", "F", "Sa", "Su"]
const MOBILE_VISIBLE_APPOINTMENTS = 2
const DESKTOP_VISIBLE_APPOINTMENTS = 4

function appointmentBlockClassName() {
  return cn(
    "block truncate rounded border border-primary/20 bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/15 sm:px-2 sm:py-1 sm:text-xs"
  )
}

export function CalendarMonthView({
  anchorDate,
  appointments,
}: {
  anchorDate: string
  appointments: CalendarAppointment[]
}) {
  const gridDays = getMonthGridDays(anchorDate)
  const appointmentsByDate = groupAppointmentsByDate(appointments)
  const today = todayDateString()

  return (
    <div className="rounded-lg border bg-background">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS_FULL.map((label, index) => (
          <div
            key={label}
            className="border-l px-1 py-2 text-center first:border-l-0 sm:px-2"
          >
            <span className="sm:hidden">{WEEKDAY_LABELS_SHORT[index]}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {gridDays.map(({ date, inMonth }) => {
          const dayAppointments = appointmentsByDate.get(date) ?? []
          const isToday = date === today
          const dayNumber = parseDateString(date).getDate()
          const mobileVisible = dayAppointments.slice(0, MOBILE_VISIBLE_APPOINTMENTS)
          const desktopVisible = dayAppointments.slice(0, DESKTOP_VISIBLE_APPOINTMENTS)
          const hiddenMobileCount =
            dayAppointments.length - MOBILE_VISIBLE_APPOINTMENTS
          const hiddenDesktopCount =
            dayAppointments.length - DESKTOP_VISIBLE_APPOINTMENTS

          const dayNumberClassName = cn(
            "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium sm:size-7 sm:text-sm",
            isToday && "bg-primary text-primary-foreground"
          )

          return (
            <div
              key={date}
              className={cn(
                "min-h-[60px] border-b border-l p-1 first:border-l-0 sm:min-h-28 sm:p-2",
                !inMonth && "bg-muted/20 text-muted-foreground"
              )}
            >
              {dayAppointments.length === 0 ? (
                <Link
                  href={newAppointmentUrl(date)}
                  className="flex min-h-[48px] flex-col hover:bg-muted/30 sm:min-h-24"
                >
                  <span className={dayNumberClassName}>{dayNumber}</span>
                </Link>
              ) : (
                <>
                  <Link
                    href={newAppointmentUrl(date)}
                    className={cn(
                      dayNumberClassName,
                      "mb-1 hover:bg-muted/60 sm:mb-2",
                      isToday && "hover:bg-primary/90"
                    )}
                  >
                    {dayNumber}
                  </Link>
                  <div className="space-y-0.5 sm:hidden">
                    {mobileVisible.map((appointment) => (
                      <Link
                        key={appointment.appointmentId}
                        href={`/appointments/${appointment.appointmentId}?returnTo=/calendar`}
                        className={appointmentBlockClassName()}
                      >
                        {formatAppointmentClientName(appointment)}
                      </Link>
                    ))}
                    {hiddenMobileCount > 0 ? (
                      <Link
                        href={buildCalendarUrl("day", date)}
                        className="block truncate text-[10px] font-medium text-muted-foreground hover:text-primary hover:underline"
                      >
                        +{hiddenMobileCount} more
                      </Link>
                    ) : null}
                  </div>
                  <div className="hidden space-y-1 sm:block">
                    {desktopVisible.map((appointment) => (
                      <Link
                        key={appointment.appointmentId}
                        href={`/appointments/${appointment.appointmentId}?returnTo=/calendar`}
                        className={appointmentBlockClassName()}
                      >
                        {formatAppointmentClientName(appointment)}
                      </Link>
                    ))}
                    {hiddenDesktopCount > 0 ? (
                      <Link
                        href={buildCalendarUrl("day", date)}
                        className="block truncate text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
                      >
                        +{hiddenDesktopCount} more
                      </Link>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
