import Link from "next/link"

import { buildCalendarUrl, getMonthGridDays, parseDateString } from "@/lib/calendar/dates"
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
const MIN_ROW_HEIGHT_REM = 3.5

export function CalendarMonthView({
  anchorDate,
  appointments,
  clientId,
  returnTo,
}: {
  anchorDate: string
  appointments: CalendarAppointment[]
  clientId?: string
  returnTo?: string
}) {
  const gridDays = getMonthGridDays(anchorDate)
  const appointmentsByDate = groupAppointmentsByDate(appointments)
  const today = todayDateString()
  const weekRowCount = gridDays.length / 7
  const gridMinHeightRem = weekRowCount * MIN_ROW_HEIGHT_REM

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col overflow-hidden rounded-lg border bg-background sm:h-[calc(100vh-280px)]">
      <div className="grid shrink-0 grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS_FULL.map((label, index) => (
          <div
            key={label}
            className={cn(
              "border-l px-1 py-2 text-center sm:px-2",
              index === 0 && "border-l-0"
            )}
          >
            <span className="sm:hidden">{WEEKDAY_LABELS_SHORT[index]}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="grid h-full min-h-0 grid-cols-7"
          style={{
            gridTemplateRows: `repeat(${weekRowCount}, minmax(${MIN_ROW_HEIGHT_REM}rem, 1fr))`,
            minHeight: `${gridMinHeightRem}rem`,
          }}
        >
          {gridDays.map(({ date, inMonth }, index) => {
            const dayAppointments = appointmentsByDate.get(date) ?? []
            const isToday = date === today
            const dayNumber = parseDateString(date).getDate()
            const mobileVisible = dayAppointments.slice(
              0,
              MOBILE_VISIBLE_APPOINTMENTS
            )
            const desktopVisible = dayAppointments.slice(
              0,
              DESKTOP_VISIBLE_APPOINTMENTS
            )
            const hiddenMobileCount =
              dayAppointments.length - MOBILE_VISIBLE_APPOINTMENTS
            const hiddenDesktopCount =
              dayAppointments.length - DESKTOP_VISIBLE_APPOINTMENTS
            const isFirstColumn = index % 7 === 0

            return (
              <Link
                key={date}
                href={buildCalendarUrl("day", date, "week", clientId, returnTo)}
                className={cn(
                  "flex min-h-0 flex-col overflow-hidden border-b border-l p-1 hover:bg-muted/30 sm:p-2",
                  isFirstColumn && "border-l-0",
                  !inMonth && "bg-muted/20 text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium sm:size-7 sm:text-sm",
                    isToday && "bg-primary text-primary-foreground",
                    dayAppointments.length > 0 && "mb-1"
                  )}
                >
                  {dayNumber}
                </span>
                {dayAppointments.length > 0 ? (
                  <>
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden sm:hidden">
                      {mobileVisible.map((appointment) => (
                        <span
                          key={appointment.appointmentId}
                          className={cn(
                            "block truncate rounded border px-1 text-[10px] font-medium",
                            appointment.status === "cancelled"
                              ? "border-muted-foreground/20 bg-muted/40 text-muted-foreground line-through"
                              : "border-primary/20 bg-primary/10 text-primary"
                          )}
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
                          className={cn(
                            "block truncate rounded border px-2 text-xs font-medium",
                            appointment.status === "cancelled"
                              ? "border-muted-foreground/20 bg-muted/40 text-muted-foreground line-through"
                              : "border-primary/20 bg-primary/10 text-primary"
                          )}
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
                  </>
                ) : null}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
