import {
  formatAppointmentTime,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"

import type { CalendarAppointment } from "@/lib/appointments/load"

export const CALENDAR_SLOT_HEIGHT_PX = 48

export function parseTimeString(time: string): { hour: number; minute: number } {
  const normalized = time.trim().slice(0, 5)
  const [hours, minutes] = normalized.split(":").map((part) => Number(part))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return { hour: 7, minute: 0 }
  }
  return { hour: hours, minute: minutes }
}

export function parseTimeStringToMinutes(time: string): number {
  const { hour, minute } = parseTimeString(time)
  return hour * 60 + minute
}

export function generateCalendarTimeSlots(
  startHour: number,
  endHour: number,
  intervalMinutes: number
): string[] {
  const slots: string[] = []
  let currentMinutes = startHour * 60
  const endMinutes = endHour * 60

  while (currentMinutes <= endMinutes) {
    const hour = Math.floor(currentMinutes / 60)
    const minute = currentMinutes % 60
    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    )
    if (currentMinutes >= endMinutes) break
    currentMinutes += intervalMinutes
  }

  return slots
}

export function generateCalendarTimeSlotsFromSettings(
  startTime: string,
  endTime: string,
  intervalMinutes: number
): string[] {
  const startMinutes = parseTimeStringToMinutes(startTime)
  const endMinutes = parseTimeStringToMinutes(endTime)
  const slots: string[] = []
  let currentMinutes = startMinutes

  while (currentMinutes <= endMinutes) {
    const hour = Math.floor(currentMinutes / 60)
    const minute = currentMinutes % 60
    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    )
    if (currentMinutes >= endMinutes) break
    currentMinutes += intervalMinutes
  }

  return slots
}

export function normalizeAppointmentTime(time: string): string {
  return time.slice(0, 5)
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = normalizeAppointmentTime(time)
    .split(":")
    .map((part) => Number(part))
  return hours * 60 + minutes
}

export function getAppointmentSlotIndex(
  time: string,
  startMinutes: number,
  intervalMinutes: number
): number {
  const minutes = timeToMinutes(time)
  const index = Math.floor((minutes - startMinutes) / intervalMinutes)
  return index >= 0 ? index : -1
}

export function getAppointmentRowSpan(
  durationMinutes: number,
  intervalMinutes: number
): number {
  return Math.max(1, Math.ceil(durationMinutes / intervalMinutes))
}

export function formatSlotLabel(slot: string): string {
  return formatAppointmentTime(`${slot}:00`)
}

export type TimedGridCell =
  | { type: "empty" }
  | { type: "skip" }
  | { type: "appointment"; appointment: CalendarAppointment; rowSpan: number }

export function buildTimedGridCells(
  date: string,
  appointments: CalendarAppointment[],
  slots: string[],
  startMinutes: number,
  intervalMinutes: number
): TimedGridCell[] {
  const states: TimedGridCell[] = slots.map(() => ({ type: "empty" }))
  const dayAppointments = appointments
    .filter((appointment) => appointment.appointmentDate === date)
    .sort((left, right) =>
      normalizeAppointmentTime(left.appointmentTime).localeCompare(
        normalizeAppointmentTime(right.appointmentTime)
      )
    )

  for (const appointment of dayAppointments) {
    const slotIndex = getAppointmentSlotIndex(
      appointment.appointmentTime,
      startMinutes,
      intervalMinutes
    )
    if (slotIndex < 0 || slotIndex >= slots.length) {
      continue
    }

    if (states[slotIndex].type !== "empty") {
      continue
    }

    const rowSpan = Math.min(
      getAppointmentRowSpan(appointment.durationMinutes, intervalMinutes),
      slots.length - slotIndex
    )

    states[slotIndex] = { type: "appointment", appointment, rowSpan }

    for (let offset = 1; offset < rowSpan; offset++) {
      states[slotIndex + offset] = { type: "skip" }
    }
  }

  return states
}

export function groupAppointmentsByDate(
  appointments: CalendarAppointment[]
): Map<string, CalendarAppointment[]> {
  const grouped = new Map<string, CalendarAppointment[]>()

  for (const appointment of appointments) {
    const existing = grouped.get(appointment.appointmentDate) ?? []
    existing.push(appointment)
    grouped.set(appointment.appointmentDate, existing)
  }

  for (const [date, dayAppointments] of grouped) {
    grouped.set(
      date,
      dayAppointments.sort((left, right) =>
        normalizeAppointmentTime(left.appointmentTime).localeCompare(
          normalizeAppointmentTime(right.appointmentTime)
        )
      )
    )
  }

  return grouped
}

export function formatAppointmentClientName(
  appointment: CalendarAppointment
): string {
  return formatClientNameLastFirst(
    appointment.clientFirstName,
    appointment.clientLastName
  )
}

export function formatTimeForInput(value: string | null | undefined): string {
  if (!value) return "07:00"
  return value.slice(0, 5)
}
