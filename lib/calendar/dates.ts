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

const WEEKDAY_SHORT_LABELS = ["M", "Tu", "W", "Th", "F", "Sa", "Su"]

export function formatDayShortLabel(dateStr: string): string {
  const date = parseDateString(dateStr)
  const jsDay = date.getDay()
  const index = jsDay === 0 ? 6 : jsDay - 1
  return WEEKDAY_SHORT_LABELS[index]
}

export function formatDayFullLabel(dateStr: string): string {
  const date = parseDateString(dateStr)
  return date.toLocaleDateString("en-AU", { weekday: "long" })
}

export function buildCalendarUrl(
  view: CalendarView,
  date: string,
  defaultView: CalendarView = "week",
  clientId?: string,
  returnTo?: string
): string {
  const params = new URLSearchParams()
  if (view !== defaultView) {
    params.set("view", view)
  }
  params.set("date", date)
  if (clientId) params.set("clientId", clientId)
  if (returnTo) params.set("returnTo", returnTo)
  const qs = params.toString()
  return `/calendar${qs ? `?${qs}` : ""}`
}

export function newAppointmentUrl(
  date: string,
  time?: string,
  clientId?: string,
  returnTo?: string
): string {
  const params = new URLSearchParams({ date, returnTo: returnTo ?? "/calendar" })
  if (time) params.set("time", time)
  if (clientId) params.set("clientId", clientId)
  return `/appointments/new?${params.toString()}`
}
