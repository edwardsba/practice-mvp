import {
  formatPartialDate,
  parsePartialDate,
  precisionForPartialDate,
} from "@/lib/client-background/partial-date"
import type { EventRecord, StartPrecision } from "@/lib/client-background/types"

export type LifeStage = "childhood" | "adulthood"

function parseDob(dob: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function completedYearsRaw(
  birth: { year: number; month: number; day: number },
  event: { year: number; month: number; day: number }
): number {
  let age = event.year - birth.year
  if (event.month < birth.month || (event.month === birth.month && event.day < birth.day)) {
    age -= 1
  }
  return age
}

function completedYears(
  birth: { year: number; month: number; day: number },
  event: { year: number; month: number; day: number }
): number | null {
  const age = completedYearsRaw(birth, event)
  if (age < 0 || age > 130) return null
  return age
}

export type AgeReading =
  | { kind: "none" }
  | { kind: "exact"; years: number }
  | { kind: "approximate"; years: number }
  | { kind: "ambiguous"; low: number; high: number }
  | { kind: "before_birth" }

type DateParts = { year: number | null; month: number | null; day: number | null }

function bounded(years: number, precise: "exact" | "approximate"): AgeReading {
  if (years < 0) return { kind: "before_birth" }
  if (years > 130) return { kind: "none" }
  return { kind: precise, years }
}

function ambiguousOrBefore(low: number, high: number): AgeReading {
  if (high < 0) return { kind: "before_birth" }
  if (high > 130 && low > 130) return { kind: "none" }
  return { kind: "ambiguous", low, high: Math.min(high, 130) }
}

/**
 * Age from a partial date.
 * Person mode: `entered` is a date of birth and `reference` is today.
 * Client-at-event mode: `entered` is the event and `reference` is the client's date of birth.
 * A year-only date is the difference in calendar years. A known month or day
 * reduces that by 1 when it falls before the reference anniversary. Year plus
 * month in the reference month is ambiguous, because the day is unknown.
 */
export function assessAge(entered: DateParts, reference: DateParts, mode: "person" | "client-at-event"): AgeReading {
  if (entered.year == null || reference.year == null) return { kind: "none" }
  const diff = mode === "person" ? reference.year - entered.year : entered.year - reference.year
  if (entered.month == null || reference.month == null) return bounded(diff, "approximate")

  if (entered.month === reference.month && (entered.day == null || reference.day == null)) {
    return ambiguousOrBefore(diff - 1, diff)
  }

  let reduce = false
  if (entered.month !== reference.month) {
    const enteredIsLaterMonth = entered.month > reference.month
    reduce = mode === "person" ? enteredIsLaterMonth : !enteredIsLaterMonth
  } else {
    const enteredDay = entered.day ?? 1
    const referenceDay = reference.day ?? 1
    reduce = mode === "person" ? enteredDay > referenceDay : enteredDay < referenceDay
  }

  const years = diff - (reduce ? 1 : 0)
  const precise = entered.day != null && reference.day != null ? "exact" : "approximate"
  return bounded(years, precise)
}

export function describeClientAge(
  dateOfBirth: string | null | undefined,
  precision: StartPrecision | "",
  value: string
): AgeReading {
  const trimmed = value.trim()
  if (!precision || !trimmed) return { kind: "none" }

  if (precision === "age") {
    if (!/^\d{1,3}$/.test(trimmed)) return { kind: "none" }
    const age = Number(trimmed)
    if (age < 0 || age > 130) return { kind: "none" }
    return { kind: "approximate", years: age }
  }

  return assessAge(parsePartialDate(trimmed), parsePartialDate(dateOfBirth ?? ""), "client-at-event")
}

export function clientAgeAtStart(
  dateOfBirth: string | null | undefined,
  precision: StartPrecision | "",
  value: string
): number | null {
  const age = describeClientAge(dateOfBirth, precision, value)
  if (age.kind === "exact" || age.kind === "approximate") return age.years
  return null
}

export function typedAgeMatches(reading: AgeReading, age: number): boolean {
  if (reading.kind === "exact" || reading.kind === "approximate") return reading.years === age
  if (reading.kind === "ambiguous") return age === reading.high || (reading.low >= 0 && age === reading.low)
  return false
}

/** Shown wherever an age is displayed. Approximate ages keep a "~". */
export function displayedAge(reading: AgeReading): string {
  if (reading.kind === "exact") return String(reading.years)
  if (reading.kind === "approximate") return `~${reading.years}`
  if (reading.kind === "ambiguous") {
    if (reading.low < 0) return `could be before birth or ${reading.high}`
    return `could be ${reading.low} or ${reading.high}`
  }
  if (reading.kind === "before_birth") return "Before client was born"
  return ""
}

/** Short line under the age input. */
export function agePrecisionNote(reading: AgeReading): string {
  if (reading.kind === "exact") return "Exact"
  if (reading.kind === "approximate") return "Approximate"
  if (reading.kind === "ambiguous" || reading.kind === "before_birth") return displayedAge(reading)
  return ""
}

/**
 * Typing an age stores only a year. `today` mode is age as of a calendar date
 * (relationship date of birth). `since-birth` mode is the client's age at an
 * event, which needs the client's own birth year.
 */
export function yearFromTypedAge(
  age: number,
  reference: { kind: "today"; asOf: string } | { kind: "since-birth"; birthDate: string }
): string | null {
  if (!Number.isInteger(age) || age < 0 || age > 130) return null
  if (reference.kind === "today") {
    const asOfYear = parsePartialDate(reference.asOf).year
    if (asOfYear == null) return null
    const year = asOfYear - age
    if (year < 1 || year > 9999) return null
    return String(year)
  }
  const birthYear = parsePartialDate(reference.birthDate).year
  if (birthYear == null) return null
  const year = birthYear + age
  if (year < 1 || year > 9999) return null
  return String(year)
}

/** Turn a legacy age-only history value into a year when the client's birth year is known. */
export function resolveAgeOnlyBoundary(
  precision: StartPrecision | "",
  value: string,
  clientDateOfBirth: string | null | undefined
): { precision: StartPrecision | ""; value: string } {
  if (precision !== "age") return { precision, value }
  const age = describeClientAge(null, "age", value)
  const birthYear = parsePartialDate(clientDateOfBirth ?? "").year
  if (age.kind !== "approximate" || birthYear == null) return { precision: "", value: "" }
  const year = birthYear + age.years
  if (year < 1 || year > 9999) return { precision, value }
  return { precision: "year", value: String(year) }
}

export function settleEventDates(event: EventRecord, clientDateOfBirth: string | null): EventRecord {
  const start = resolveAgeOnlyBoundary(event.startPrecision, event.startValue, clientDateOfBirth)
  const end = resolveAgeOnlyBoundary(event.endPrecision, event.endValue, clientDateOfBirth)
  if (
    start.precision === event.startPrecision &&
    start.value === event.startValue &&
    end.precision === event.endPrecision &&
    end.value === event.endValue
  ) {
    return event
  }
  return {
    ...event,
    startPrecision: start.precision,
    startValue: start.value,
    endPrecision: end.precision,
    endValue: end.value,
  }
}

/** Completed years from one calendar date to another. Both values are yyyy-MM-dd. */
export function completedYearsBetween(fromDate: string, toDate: string): number | null {
  const from = parseDob(fromDate)
  const to = parseDob(toDate)
  if (!from || !to) return null
  return completedYears(from, to)
}

export function lifeStageAtStart(
  dateOfBirth: string | null | undefined,
  precision: StartPrecision | "",
  value: string
): LifeStage | null {
  const age = describeClientAge(dateOfBirth, precision, value)
  if (age.kind === "exact" || age.kind === "approximate") return age.years < 18 ? "childhood" : "adulthood"
  if (age.kind === "ambiguous") {
    if (age.high < 18) return "childhood"
    if (age.low >= 18) return "adulthood"
  }
  return null
}

/**
 * Smaller numbers are earlier. Null means no start was recorded.
 * Year-only dates anchor to 1 January, and year-month dates to the 1st.
 * An age with a date of birth is placed on the birthday of that year of life.
 */
export function eventStartSortKey(
  dateOfBirth: string | null | undefined,
  precision: StartPrecision | "",
  value: string
): number | null {
  const trimmed = value.trim()
  if (!precision || !trimmed) return null

  if (precision === "year" && /^\d{4}$/.test(trimmed)) return Number(trimmed) * 10000

  if (precision === "year_month") {
    const match = /^(\d{4})-(\d{2})$/.exec(trimmed)
    if (!match) return null
    return Number(match[1]) * 10000 + Number(match[2]) * 100
  }

  if (precision === "date") {
    const event = parseDob(trimmed)
    if (!event) return null
    return event.year * 10000 + event.month * 100 + event.day
  }

  if (precision === "age" && /^\d{1,3}$/.test(trimmed)) {
    const age = Number(trimmed)
    if (age < 0 || age > 130) return null
    const birth = dateOfBirth ? parseDob(dateOfBirth) : null
    if (!birth) return age
    return (birth.year + age) * 10000 + birth.month * 100 + birth.day
  }

  return null
}

export function compareEventsChronologically(
  a: { startPrecision: StartPrecision | ""; startValue: string; displayOrder: number },
  b: { startPrecision: StartPrecision | ""; startValue: string; displayOrder: number },
  dateOfBirth: string | null | undefined
): number {
  const aKey = eventStartSortKey(dateOfBirth, a.startPrecision, a.startValue)
  const bKey = eventStartSortKey(dateOfBirth, b.startPrecision, b.startValue)
  if (aKey == null && bKey == null) return a.displayOrder - b.displayOrder
  if (aKey == null) return -1
  if (bKey == null) return 1
  if (aKey !== bKey) return aKey - bKey
  return a.displayOrder - b.displayOrder
}

export function formatPartialWhen(
  precision: StartPrecision | "",
  value: string,
  ongoing = false
): string {
  if (ongoing && !value.trim()) return "Ongoing"
  const trimmed = value.trim()
  if (!trimmed) return ongoing ? "Ongoing" : ""
  if (precision === "age") return `Age ${trimmed}`
  if (precision === "year_month") {
    const match = /^(\d{4})-(\d{2})$/.exec(trimmed)
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
      const label = date.toLocaleDateString("en-AU", { month: "short", year: "numeric" })
      return ongoing ? `${label} – ongoing` : label
    }
  }
  if (precision === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      const label = date.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      return ongoing ? `${label} – ongoing` : label
    }
  }
  return ongoing ? `${trimmed} – ongoing` : trimmed
}

/** Display label for a stored YYYY / YYYY-MM / YYYY-MM-DD value. */
export function formatPartialDateLabel(value: string): string {
  const parsed = parsePartialDate(value)
  const precision = precisionForPartialDate(parsed)
  if (!precision) return ""
  return formatPartialWhen(precision, formatPartialDate(parsed))
}
