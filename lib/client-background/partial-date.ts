import type { StartPrecision } from "@/lib/client-background/types"

/** A date that may omit the month, the day, or both. Year is the only required part. */
export type PartialDate = {
  year: number | null
  month: number | null
  day: number | null
}

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function emptyPartialDate(): PartialDate {
  return { year: null, month: null, day: null }
}

/** Accepts YYYY, YYYY-MM, and YYYY-MM-DD. Anything else is empty. */
export function parsePartialDate(value: string): PartialDate {
  const text = value.trim()
  const full = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text)
  if (full) {
    const year = Number(full[1])
    const month = Number(full[2])
    const day = Number(full[3])
    if (month < 1 || month > 12) return { year, month: null, day: null }
    if (day < 1 || day > 31) return { year, month, day: null }
    return { year, month, day }
  }
  const yearMonth = /^(\d{4})-(\d{2})$/.exec(text)
  if (yearMonth) {
    const year = Number(yearMonth[1])
    const month = Number(yearMonth[2])
    if (month < 1 || month > 12) return { year, month: null, day: null }
    return { year, month, day: null }
  }
  const yearOnly = /^(\d{4})$/.exec(text)
  if (yearOnly) return { year: Number(yearOnly[1]), month: null, day: null }
  return emptyPartialDate()
}

export function formatPartialDate(date: PartialDate): string {
  if (date.year == null) return ""
  const year = String(date.year).padStart(4, "0")
  if (date.month == null) return year
  const month = String(date.month).padStart(2, "0")
  if (date.day == null) return `${year}-${month}`
  return `${year}-${month}-${String(date.day).padStart(2, "0")}`
}

export function precisionForPartialDate(date: PartialDate): StartPrecision | "" {
  if (date.year == null) return ""
  if (date.month == null) return "year"
  if (date.day == null) return "year_month"
  return "date"
}

/** Canonical YYYY / YYYY-MM / YYYY-MM-DD, or empty when the text is not a partial date. */
export function canonicalPartialDate(value: string): string {
  return formatPartialDate(parsePartialDate(value))
}
