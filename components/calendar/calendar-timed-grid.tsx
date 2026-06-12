import Link from "next/link"

import { formatDayColumnHeader, newAppointmentUrl } from "@/lib/calendar/dates"
import {
  isSlotAvailable,
  type AvailabilityBlock,
} from "@/lib/calendar/availability"
import {
  buildTimedGridCells,
  CALENDAR_SLOT_HEIGHT_PX,
  formatAppointmentClientName,
  formatSlotLabel,
  generateCalendarTimeSlotsFromSettings,
  parseTimeStringToMinutes,
} from "@/lib/calendar/time-slots"
import type { CalendarAppointment } from "@/lib/appointments/load"
import { todayDateString } from "@/lib/appointments/format"
import { cn } from "@/lib/utils"

const MOBILE_INTERVAL_MINUTES = 60

type CalendarSettings = {
  startTime: string
  endTime: string
  intervalMinutes: number
}

function AppointmentBlock({
  appointment,
  rowSpan,
}: {
  appointment: CalendarAppointment
  rowSpan: number
}) {
  return (
    <Link
      href={`/appointments/${appointment.appointmentId}?returnTo=/calendar`}
      className="flex h-full min-h-0 flex-col justify-center rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
      style={{ minHeight: rowSpan * CALENDAR_SLOT_HEIGHT_PX - 4 }}
    >
      {formatAppointmentClientName(appointment)}
    </Link>
  )
}

function TimedGridTable({
  days,
  appointments,
  slots,
  startMinutes,
  intervalMinutes,
  availabilityBlocks,
}: {
  days: string[]
  appointments: CalendarAppointment[]
  slots: string[]
  startMinutes: number
  intervalMinutes: number
  availabilityBlocks: AvailabilityBlock[]
}) {
  const today = todayDateString()
  const cellsByDay = new Map(
    days.map((day) => [
      day,
      buildTimedGridCells(
        day,
        appointments,
        slots,
        startMinutes,
        intervalMinutes
      ),
    ])
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
                const available = isSlotAvailable(day, slot, availabilityBlocks)

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
                    className={cn(
                      "border-b border-l p-0 align-top",
                      !available && "bg-muted/30"
                    )}
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

export function CalendarTimedGrid({
  days,
  appointments,
  calendarSettings,
  availabilityBlocks,
}: {
  days: string[]
  appointments: CalendarAppointment[]
  calendarSettings: CalendarSettings
  availabilityBlocks: AvailabilityBlock[]
}) {
  const startMinutes = parseTimeStringToMinutes(calendarSettings.startTime)
  const mobileSlots = generateCalendarTimeSlotsFromSettings(
    calendarSettings.startTime,
    calendarSettings.endTime,
    MOBILE_INTERVAL_MINUTES
  )
  const desktopSlots = generateCalendarTimeSlotsFromSettings(
    calendarSettings.startTime,
    calendarSettings.endTime,
    calendarSettings.intervalMinutes
  )

  return (
    <>
      <div className="block md:hidden">
        <TimedGridTable
          days={days}
          appointments={appointments}
          slots={mobileSlots}
          startMinutes={startMinutes}
          intervalMinutes={MOBILE_INTERVAL_MINUTES}
          availabilityBlocks={availabilityBlocks}
        />
      </div>
      <div className="hidden md:block">
        <TimedGridTable
          days={days}
          appointments={appointments}
          slots={desktopSlots}
          startMinutes={startMinutes}
          intervalMinutes={calendarSettings.intervalMinutes}
          availabilityBlocks={availabilityBlocks}
        />
      </div>
    </>
  )
}
