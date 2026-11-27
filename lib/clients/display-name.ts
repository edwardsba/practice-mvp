/**
 * Client display name for headers and interview.
 * When preferred is set: "First (Preferred) Last". Letters/reports/emails do not use this yet.
 */
export function formatClientDisplayName(
  firstName: string,
  preferredName: string | null | undefined,
  lastName: string
): string {
  const first = firstName.trim()
  const last = lastName.trim()
  const preferred = preferredName?.trim()
  if (preferred) return `${first} (${preferred}) ${last}`.trim()
  return `${first} ${last}`.trim()
}
