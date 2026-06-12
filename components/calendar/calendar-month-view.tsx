import Link from "next/link"

import { getMonthGridDays, parseDateString } from "@/lib/calendar/dates"
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
  const weekRowCount = gridDays.length / 7

  return (
    <div className="flex h-[calc(100vh-320px)] min-h-[420px] flex-col rounded-lg border bg-background">
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
      <div
        className="grid flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weekRowCount}, 1fr)` }}
      >
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

          return (
            <Link
              key={date}
              href={`/calendar?view=day&date=${date}`}
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden border-b border-l p-1 first:border-l-0 hover:bg-muted/30 sm:p-2",
                !inMonth && "bg-muted/20 text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "mb-1 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium sm:size-7 sm:text-sm",
                  isToday && "bg-primary text-primary-foreground"
                )}
              >
                {dayNumber}
              </span>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                <div className="space-y-0.5 sm:hidden">
                  {mobileVisible.map((appointment) => (
                    <span
                      key={appointment.appointmentId}
                      className="block truncate rounded border border-primary/20 bg-primary/10 px-1 text-[10px] font-medium text-primary"
                    >
                      {formatAppointmentClientName(appointment)}
                    </span>
                  ))}
                  {hiddenMobileCount > 0 ? (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      +{hiddenMobileCount} more
                    </span>
                  ) : null}
                </div>
                <div className="hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                  {desktopVisible.map((appointment) => (
                    <span
                      key={appointment.appointmentId}
                      className="block truncate rounded border border-primary/20 bg-primary/10 px-2 text-xs font-medium text-primary"
                    >
                      {formatAppointmentClientName(appointment)}
                    </span>
                  ))}
                  {hiddenDesktopCount > 0 ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      +{hiddenDesktopCount} more
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
