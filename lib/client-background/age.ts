import type { StartPrecision } from "@/lib/client-background/types"

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

function completedYears(
  birth: { year: number; month: number; day: number },
  event: { year: number; month: number; day: number }
): number | null {
  let age = event.year - birth.year
  if (event.month < birth.month || (event.month === birth.month && event.day < birth.day)) {
    age -= 1
  }
  if (age < 0 || age > 130) return null
  return age
}

/**
 * Client's age at Start. Year-only dates anchor to 1 January, and
 * year-month dates anchor to the 1st, so the age is the completed years
 * at the earliest moment that start could be. Age-only starts do not need a DOB.
 */
export function clientAgeAtStart(
  dateOfBirth: string | null | undefined,
  precision: StartPrecision | "",
  value: string
): number | null {
  const trimmed = value.trim()
  if (!precision || !trimmed) return null

  if (precision === "age") {
    if (!/^\d{1,3}$/.test(trimmed)) return null
    const age = Number(trimmed)
    if (age < 0 || age > 130) return null
    return age
  }

  const birth = dateOfBirth ? parseDob(dateOfBirth) : null
  if (!birth) return null

  if (precision === "year" && /^\d{4}$/.test(trimmed)) {
    return completedYears(birth, { year: Number(trimmed), month: 1, day: 1 })
  }

  if (precision === "year_month") {
    const match = /^(\d{4})-(\d{2})$/.exec(trimmed)
    if (!match) return null
    return completedYears(birth, {
      year: Number(match[1]),
      month: Number(match[2]),
      day: 1,
    })
  }

  if (precision === "date") {
    const event = parseDob(trimmed)
    if (!event) return null
    return completedYears(birth, event)
  }

  return null
}

export function lifeStageAtStart(
  dateOfBirth: string | null | undefined,
  precision: StartPrecision | "",
  value: string
): LifeStage | null {
  const age = clientAgeAtStart(dateOfBirth, precision, value)
  if (age == null) return null
  return age < 18 ? "childhood" : "adulthood"
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
