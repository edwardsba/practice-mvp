export type EmergencyContactSummaryInput = {
  name: string
  role: string | null
  phone: string | null
}

/**
 * Collapsed Emergency details line for the first contact (+ N more).
 */
export function formatEmergencyContactSummary(
  contacts: EmergencyContactSummaryInput[]
): string {
  if (contacts.length === 0) return "None recorded"

  const first = contacts[0]
  const namePart = first.role?.trim()
    ? `${first.name} (${first.role.trim()})`
    : first.name
  const withPhone = first.phone?.trim()
    ? `${namePart} · ${first.phone.trim()}`
    : namePart

  const more = contacts.length - 1
  if (more > 0) return `${withPhone} · + ${more} more`
  return withPhone
}

export function formatCrisisPlanSummary(plan: {
  versionNumber: number
  dateOfPlan: string
} | null): string {
  if (!plan) return "No crisis plan"
  const date = formatLongDate(plan.dateOfPlan)
  return `v${plan.versionNumber} · ${date}`
}

function formatLongDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    // date-only strings (YYYY-MM-DD) parse as UTC midnight; still format if valid parts
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (match) {
      const local = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
      return local.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    }
    return value
  }
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
