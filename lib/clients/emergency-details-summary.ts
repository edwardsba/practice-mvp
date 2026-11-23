export type EmergencyContactSummaryInput = {
  name: string
  role: string | null
  phone: string | null
  email: string | null
}

/**
 * Emergency details lines: every contact, one per line.
 * Format: Name (role) · phone · email — omit any missing part.
 */
export function formatEmergencyContactSummary(
  contacts: EmergencyContactSummaryInput[]
): string {
  if (contacts.length === 0) return "None recorded"

  return contacts.map(formatOneEmergencyContact).join("\n")
}

function formatOneEmergencyContact(
  contact: EmergencyContactSummaryInput
): string {
  const parts: string[] = []
  const namePart = contact.role?.trim()
    ? `${contact.name} (${contact.role.trim()})`
    : contact.name
  parts.push(namePart)
  if (contact.phone?.trim()) parts.push(contact.phone.trim())
  if (contact.email?.trim()) parts.push(contact.email.trim())
  return parts.join(" · ")
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
