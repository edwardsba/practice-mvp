import Link from "next/link"

import { formatDayShortLabel, newAppointmentUrl, parseDateString } from "@/lib/calendar/dates"
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
      className="flex h-full min-h-0 flex-col justify-center truncate rounded-md border border-primary/20 bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/15 sm:px-2 sm:py-1 sm:text-xs"
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
    <div className="rounded-lg border bg-background">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-12 border-b bg-muted/40 px-1 py-2 text-left text-[10px] font-medium text-muted-foreground sm:w-20 sm:px-2 sm:text-xs" />
            {days.map((day) => {
              const isToday = day === today
              const dayNumber = parseDateString(day).getDate()

              return (
                <th
                  key={day}
                  className={cn(
                    "border-b border-l px-1 py-2 text-center text-xs font-medium sm:px-2",
                    isToday
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/40 text-muted-foreground"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] uppercase sm:text-xs">
                      {formatDayShortLabel(day)}
                    </span>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-sm font-medium sm:size-7",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {dayNumber}
                    </span>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, slotIndex) => (
            <tr key={slot}>
              <td className="border-b bg-muted/20 px-1 py-1 text-[10px] text-muted-foreground sm:px-2 sm:text-xs">
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
                      className="border-b border-l p-0.5 align-top sm:p-1"
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
