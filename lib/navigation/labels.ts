/**
 * NV-5 back-label helpers. Labels always say where Back goes.
 */

/** Cut names longer than 32 characters with "…" (NV-5). */
export function truncateNavName(name: string, max = 32): string {
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function backLabel(destination: string): string {
  return `← Back to ${destination}`
}

/** DT-1 date: day, short month, year (e.g. 12 Nov 2026). */
export function formatNavDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return ""
  const date =
    value instanceof Date
      ? value
      : new Date(
          typeof value === "string" && value.includes("T")
            ? value
            : `${value}T00:00:00`
        )
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function datedRecordLabel(kind: string, date: string | Date | null | undefined): string {
  const formatted = formatNavDate(date)
  if (!formatted) return kind
  return `${kind}, ${formatted}`
}
