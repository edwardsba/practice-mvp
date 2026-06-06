import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"

import { todayDateString } from "@/lib/appointments/format"

export type CalendarView = "day" | "week" | "month"

export function parseCalendarView(value: string | undefined): CalendarView {
  if (value === "day" || value === "month") {
    return value
  }
  return "week"
}

export function parseAnchorDate(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  return todayDateString()
}

export function parseDateString(dateStr: string): Date {
  return parseISO(`${dateStr}T12:00:00`)
}

export function getCalendarLoadRange(
  view: CalendarView,
  anchorDate: string
): { start: string; end: string } {
  const anchor = parseDateString(anchorDate)

  if (view === "day") {
    return { start: anchorDate, end: anchorDate }
  }

  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 })
    const end = endOfWeek(anchor, { weekStartsOn: 1 })
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    }
  }

  const monthStart = startOfMonth(anchor)
  const rangeStart = startOfMonth(addMonths(monthStart, -1))
  const rangeEnd = endOfMonth(addMonths(monthStart, 1))
  return {
    start: format(rangeStart, "yyyy-MM-dd"),
    end: format(rangeEnd, "yyyy-MM-dd"),
  }
}

export function shiftAnchorDate(
  anchorDate: string,
  view: CalendarView,
  direction: -1 | 1
): string {
  const anchor = parseDateString(anchorDate)

  if (view === "day") {
    return format(addDays(anchor, direction), "yyyy-MM-dd")
  }

  if (view === "week") {
    return format(addWeeks(anchor, direction), "yyyy-MM-dd")
  }

  return format(addMonths(anchor, direction), "yyyy-MM-dd")
}

export function getWeekDays(anchorDate: string): string[] {
  const anchor = parseDateString(anchorDate)
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  const end = endOfWeek(anchor, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end }).map((day) =>
    format(day, "yyyy-MM-dd")
  )
}

export type MonthGridDay = {
  date: string
  inMonth: boolean
}

export function getMonthGridDays(anchorDate: string): MonthGridDay[] {
  const anchor = parseDateString(anchorDate)
  const monthStart = startOfMonth(anchor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const monthEnd = endOfMonth(anchor)
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((day) => ({
    date: format(day, "yyyy-MM-dd"),
    inMonth: day >= monthStart && day <= monthEnd,
  }))
}

export function formatCalendarPeriodLabel(
  view: CalendarView,
  anchorDate: string
): string {
  const anchor = parseDateString(anchorDate)

  if (view === "day") {
    return anchor.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 })
    const end = endOfWeek(anchor, { weekStartsOn: 1 })
    const startLabel = start.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    const endLabel = end.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    return `${startLabel} – ${endLabel}`
  }

  return anchor.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  })
}

export function formatDayColumnHeader(dateStr: string): string {
  const date = parseDateString(dateStr)
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function buildCalendarUrl(
  view: CalendarView,
  date: string,
  defaultView: CalendarView = "week"
): string {
  const params = new URLSearchParams()
  if (view !== defaultView) {
    params.set("view", view)
  }
  if (date !== todayDateString()) {
    params.set("date", date)
  }
  const query = params.toString()
  return query ? `/calendar?${query}` : "/calendar"
}

export function newAppointmentUrl(date: string, time?: string): string {
  const params = new URLSearchParams({ date, returnTo: "/calendar" })
  if (time) {
    params.set("time", time)
  }
  return `/appointments/new?${params.toString()}`
}
