import Link from "next/link"

import { formatDayColumnHeader, newAppointmentUrl } from "@/lib/calendar/dates"
import {
  buildTimedGridCells,
  CALENDAR_SLOT_HEIGHT_PX,
  formatAppointmentClientName,
  formatSlotLabel,
  generateCalendarTimeSlots,
} from "@/lib/calendar/time-slots"
import type { CalendarAppointment } from "@/lib/appointments/load"
import { todayDateString } from "@/lib/appointments/format"
import { appendReturnTo } from "@/lib/navigation/back"
import { cn } from "@/lib/utils"

function AppointmentBlock({
  appointment,
  rowSpan,
}: {
  appointment: CalendarAppointment
  rowSpan: number
}) {
  return (
    <Link
      href={appendReturnTo(
        `/appointments/${appointment.appointmentId}`,
        "/calendar"
      )}
      className="flex h-full min-h-0 flex-col justify-center rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
      style={{ minHeight: rowSpan * CALENDAR_SLOT_HEIGHT_PX - 4 }}
    >
      {formatAppointmentClientName(appointment)}
    </Link>
  )
}

export function CalendarTimedGrid({
  days,
  appointments,
}: {
  days: string[]
  appointments: CalendarAppointment[]
}) {
  const slots = generateCalendarTimeSlots()
  const today = todayDateString()
  const cellsByDay = new Map(
    days.map((day) => [day, buildTimedGridCells(day, appointments, slots)])
  )

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-20 border-b bg-muted/40 px-2 py-2 text-left text-xs font-medium text-muted-foreground" />
            {days.map((day) => {
              const isToday = day === today
              return (
                <th
                  key={day}
                  className={cn(
                    "border-b border-l px-2 py-2 text-left text-xs font-medium",
                    isToday
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/40 text-muted-foreground"
                  )}
                >
                  {formatDayColumnHeader(day)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, slotIndex) => (
            <tr key={slot}>
              <td className="border-b bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                {formatSlotLabel(slot)}
              </td>
              {days.map((day) => {
                const cells = cellsByDay.get(day)!
                const cell = cells[slotIndex]

                if (cell.type === "skip") {
                  return null
                }

                if (cell.type === "appointment") {
                  return (
                    <td
                      key={`${day}-${slot}`}
                      rowSpan={cell.rowSpan}
                      className="border-b border-l p-1 align-top"
                    >
                      <AppointmentBlock
                        appointment={cell.appointment}
                        rowSpan={cell.rowSpan}
                      />
                    </td>
                  )
                }

                return (
                  <td
                    key={`${day}-${slot}`}
                    className="border-b border-l p-0 align-top"
                  >
                    <Link
                      href={newAppointmentUrl(day, slot)}
                      className="block hover:bg-muted/50"
                      style={{ height: CALENDAR_SLOT_HEIGHT_PX }}
                      aria-label={`Add appointment on ${day} at ${slot}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
