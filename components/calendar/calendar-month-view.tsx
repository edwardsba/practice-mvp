import Link from "next/link"

import {
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

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
    <div className="overflow-x-auto rounded-lg border bg-background">
      <div className="grid min-w-[720px] grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-l px-2 py-2 first:border-l-0">
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-w-[720px] grid-cols-7">
        {gridDays.map(({ date, inMonth }) => {
          const dayAppointments = appointmentsByDate.get(date) ?? []
          const isToday = date === today
          const dayNumber = parseDateString(date).getDate()

          return (
            <div
              key={date}
              className={cn(
                "min-h-28 border-b border-l p-2 first:border-l-0",
                !inMonth && "bg-muted/20 text-muted-foreground"
              )}
            >
              {dayAppointments.length === 0 ? (
                <Link
                  href={newAppointmentUrl(date)}
                  className="flex min-h-24 flex-col hover:bg-muted/30"
                >
                  <span
                    className={cn(
                      "mb-2 inline-flex size-7 items-center justify-center rounded-full text-sm font-medium",
                      isToday &&
                        "bg-primary text-primary-foreground"
                    )}
                  >
                    {dayNumber}
                  </span>
                </Link>
              ) : (
                <>
                  <Link
                    href={newAppointmentUrl(date)}
                    className={cn(
                      "mb-2 inline-flex size-7 items-center justify-center rounded-full text-sm font-medium hover:bg-muted/60",
                      isToday &&
                        "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {dayNumber}
                  </Link>
                  <div className="space-y-1">
                    {dayAppointments.map((appointment) => (
                      <Link
                        key={appointment.appointmentId}
                        href={`/appointments/${appointment.appointmentId}`}
                        className="block truncate rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                      >
                        {formatAppointmentClientName(appointment)}
                      </Link>
                    ))}
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
