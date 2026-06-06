import {
  formatAppointmentTime,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"

import type { CalendarAppointment } from "@/lib/appointments/load"

export const CALENDAR_SLOT_START_HOUR = 7
export const CALENDAR_SLOT_END_HOUR = 20
export const CALENDAR_SLOT_INTERVAL_MINUTES = 30
export const CALENDAR_SLOT_HEIGHT_PX = 48

export function generateCalendarTimeSlots(): string[] {
  const slots: string[] = []

  for (let hour = CALENDAR_SLOT_START_HOUR; hour <= CALENDAR_SLOT_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      if (hour === CALENDAR_SLOT_END_HOUR && minute > 0) {
        break
      }
      slots.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      )
    }
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

export function getAppointmentSlotIndex(time: string): number {
  const startMinutes = CALENDAR_SLOT_START_HOUR * 60
  const minutes = timeToMinutes(time)
  const index = Math.floor(
    (minutes - startMinutes) / CALENDAR_SLOT_INTERVAL_MINUTES
  )
  return index >= 0 ? index : -1
}

export function getAppointmentRowSpan(durationMinutes: number): number {
  return Math.max(1, Math.ceil(durationMinutes / CALENDAR_SLOT_INTERVAL_MINUTES))
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
  slots: string[]
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
    const slotIndex = getAppointmentSlotIndex(appointment.appointmentTime)
    if (slotIndex < 0 || slotIndex >= slots.length) {
      continue
    }

    if (states[slotIndex].type !== "empty") {
      continue
    }

    const rowSpan = Math.min(
      getAppointmentRowSpan(appointment.durationMinutes),
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

export function formatAppointmentClientName(appointment: CalendarAppointment): string {
  return formatClientNameLastFirst(
    appointment.clientFirstName,
    appointment.clientLastName
  )
}
