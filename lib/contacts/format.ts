export function formatProfessionalName(
  title: string | null,
  firstName: string,
  lastName: string
): string {
  const parts = [title?.trim(), lastName.trim(), firstName.trim()].filter(Boolean)
  if (title?.trim()) {
    return `${title.trim()} ${lastName}, ${firstName}`
  }
  return `${lastName}, ${firstName}`
}

export function formatOrganisationAddress(
  streetAddress: string | null,
  postalAddress: string | null
): string {
  const street = streetAddress?.trim()
  const postal = postalAddress?.trim()
  if (street && postal && street !== postal) {
    return `${street} · ${postal}`
  }
  return street || postal || "—"
}
