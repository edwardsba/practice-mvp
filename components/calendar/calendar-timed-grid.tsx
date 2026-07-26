import Link from "next/link"

import { PsqStatusBadge } from "@/components/session-notes/psq-status-badge"
import {
  formatDayFullLabel,
  formatDayShortLabel,
  newAppointmentUrl,
  parseDateString,
} from "@/lib/calendar/dates"
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
import { resolveAppointmentLocationText } from "@/lib/appointments/location"
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
  detailed,
}: {
  appointment: CalendarAppointment
  rowSpan: number
  detailed: boolean
}) {
  const blockHeight = rowSpan * CALENDAR_SLOT_HEIGHT_PX - 8
  const showExtraDetail = detailed && blockHeight >= 72
  const isCancelled = appointment.status === "cancelled"

  if (!showExtraDetail) {
    return (
      <Link
        href={`/appointments/${appointment.appointmentId}?returnTo=/calendar`}
        className={cn(
          "flex h-full min-h-0 flex-col justify-center truncate rounded-md border px-1 text-[10px] font-medium leading-tight sm:px-2 sm:text-xs",
          isCancelled
            ? "border-muted-foreground/20 bg-muted/40 text-muted-foreground hover:bg-muted/50"
            : "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
        )}
        style={{ minHeight: blockHeight }}
      >
        <span className={cn(isCancelled && "line-through")}>
          {formatAppointmentClientName(appointment)}
        </span>
      </Link>
    )
  }

  const locationText =
    appointment.mode === "online"
      ? "Online"
      : resolveAppointmentLocationText(
          appointment.location,
          appointment.practiceLocationNickname,
          appointment.practiceAddress,
          appointment.practiceName
        )

  return (
    <Link
      href={`/appointments/${appointment.appointmentId}?returnTo=/calendar`}
      className={cn(
        "flex h-full min-h-0 flex-col justify-center gap-1 truncate rounded-md border px-2 py-1.5 text-xs font-medium leading-tight",
        isCancelled
          ? "border-muted-foreground/20 bg-muted/40 text-muted-foreground hover:bg-muted/50"
          : "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
      )}
      style={{ minHeight: blockHeight }}
    >
      <span className={cn("truncate", isCancelled && "line-through")}>
        {formatAppointmentClientName(appointment)}
      </span>
      <span
        className={cn(
          "truncate text-[11px] font-normal",
          isCancelled ? "text-muted-foreground" : "text-primary/80"
        )}
      >
        {locationText}
      </span>
      {isCancelled ? (
        <span className="text-[11px] font-normal text-muted-foreground">
          Cancelled
        </span>
      ) : (
        <PsqStatusBadge
          sentAt={appointment.preSessionBatterySentAt}
          psqBatteryStatus={appointment.psqBatteryStatus}
        />
      )}
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
  clientId,
  returnTo,
}: {
  days: string[]
  appointments: CalendarAppointment[]
  slots: string[]
  startMinutes: number
  intervalMinutes: number
  availabilityBlocks: AvailabilityBlock[]
  clientId?: string
  returnTo?: string
}) {
  const today = todayDateString()
  const isDayView = days.length === 1
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
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-12 border-b bg-muted/40 px-1 py-2 text-left text-[10px] font-medium text-muted-foreground sm:w-20 sm:px-2 sm:text-xs" />
            {days.map((day) => {
              const isToday = day === today
              const dayNumber = parseDateString(day).getDate()

              return (
                <th
                  key={day}
                  className="border-b border-l bg-muted/40 px-1 py-2 text-center text-xs font-medium text-muted-foreground sm:px-2"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        "uppercase",
                        isDayView ? "text-sm sm:text-base" : "text-[10px] sm:text-xs"
                      )}
                    >
                      {isDayView ? formatDayFullLabel(day) : formatDayShortLabel(day)}
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
              <td className="w-12 border-b bg-muted/20 px-1 py-1 text-[10px] text-muted-foreground sm:w-20 sm:px-2 sm:text-xs">
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
                        detailed={isDayView}
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
                      href={newAppointmentUrl(day, slot, clientId, returnTo)}
                      className={cn(
                        "block truncate",
                        available
                          ? "hover:bg-muted/50"
                          : "bg-muted/30 hover:bg-muted/40"
                      )}
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
  clientId,
  returnTo,
}: {
  days: string[]
  appointments: CalendarAppointment[]
  calendarSettings: CalendarSettings
  availabilityBlocks: AvailabilityBlock[]
  clientId?: string
  returnTo?: string
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
          clientId={clientId}
          returnTo={returnTo}
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
          clientId={clientId}
          returnTo={returnTo}
        />
      </div>
    </>
  )
}
