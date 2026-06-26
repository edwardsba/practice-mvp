export const DAY_OF_WEEK_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export const AVAILABILITY_MODES = ["face_to_face", "online", "both"] as const

export type AvailabilityMode = (typeof AVAILABILITY_MODES)[number]

export const AVAILABILITY_MODE_LABELS: Record<AvailabilityMode, string> = {
  face_to_face: "Face to face",
  online: "Online",
  both: "Both",
}

type PractitionerNameFields = {
  title?: string | null
  firstName: string
  preferredName?: string | null
  lastName: string
  reportSignature?: string | null
}

function composePractitionerNameParts(
  profile: Omit<PractitionerNameFields, "reportSignature">
): string {
  const nameParts = [profile.firstName.trim()]
  if (profile.preferredName?.trim()) {
    nameParts.push(`(${profile.preferredName.trim()})`)
  }
  nameParts.push(profile.lastName.trim())

  const name = nameParts.filter(Boolean).join(" ")
  return [profile.title?.trim(), name].filter(Boolean).join(" ")
}

export function formatPractitionerPreferredName(
  profile: Pick<PractitionerNameFields, "firstName" | "preferredName" | "lastName">
): string {
  const firstName = profile.preferredName?.trim() || profile.firstName.trim()
  return [firstName, profile.lastName.trim()].filter(Boolean).join(" ")
}

export function formatPractitionerViewName(
  profile: Omit<PractitionerNameFields, "reportSignature">
): string {
  return composePractitionerNameParts(profile)
}

/**
 * Formal name for printed report headers: title + firstName + lastName only.
 * Deliberately ignores reportSignature and preferredName — not appropriate
 * for the client-facing header block of a clinical document.
 */
export function formatPractitionerFormalName(
  profile: Pick<PractitionerNameFields, "title" | "firstName" | "lastName">
): string {
  const name = [profile.firstName.trim(), profile.lastName.trim()]
    .filter(Boolean)
    .join(" ")
  return [profile.title?.trim(), name].filter(Boolean).join(" ")
}

export function formatPractitionerRegistration(
  registrationBody?: string | null,
  registrationNumber?: string | null
): string {
  return [registrationBody?.trim(), registrationNumber?.trim()]
    .filter(Boolean)
    .join(" ")
}

export function formatPractitionerName(
  profile: PractitionerNameFields
): string {
  if (profile.reportSignature?.trim()) {
    return profile.reportSignature.trim()
  }

  return composePractitionerNameParts(profile)
}

export function formatDayOfWeek(dayOfWeek: number): string {
  return DAY_OF_WEEK_NAMES[dayOfWeek] ?? String(dayOfWeek)
}

export function formatAvailabilityMode(mode: string): string {
  if (mode in AVAILABILITY_MODE_LABELS) {
    return AVAILABILITY_MODE_LABELS[mode as AvailabilityMode]
  }
  return mode
}

export function formatTimeForDisplay(time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time
  const [hours, minutes] = normalized.split(":").map((part) => Number(part))
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
