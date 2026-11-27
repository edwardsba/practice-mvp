/**
 * Display-only Australian phone formatting. Does not change stored values.
 */

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Format a phone number for display:
 * - mobiles as `0400 000 000`
 * - landlines as `(02) 9000 0000`
 * - `+61` numbers converted to the local form first
 * - anything else left unchanged
 */
export function formatAustralianPhone(value: string | null | undefined): string {
  if (value == null) return ""
  const original = value.trim()
  if (!original) return ""

  let digits = digitsOnly(original)

  // +61 / 61 international → drop country code and lead with 0
  if (digits.startsWith("61") && digits.length >= 10 && digits.length <= 11) {
    digits = `0${digits.slice(2)}`
  }

  // Mobile: 04xx xxx xxx (10 digits)
  if (/^04\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }

  // Landline: 0N xxxx xxxx where N is 2–8 (not 4)
  if (/^0[2-8]\d{8}$/.test(digits) && !digits.startsWith("04")) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)} ${digits.slice(6)}`
  }

  return original
}
