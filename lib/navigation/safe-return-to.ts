/**
 * Accept only internal return paths under /clients/ or /funding/.
 * Rejects scheme URLs, protocol-relative "//…", and ".." segments.
 */
export function safeReturnTo(
  value: string | null | undefined
): string | null {
  if (value == null) return null
  const path = value.trim()
  if (!path) return null
  if (!path.startsWith("/")) return null
  if (path.startsWith("//")) return null
  if (path.includes("://")) return null
  if (path.includes("..")) return null
  if (!(path.startsWith("/clients/") || path.startsWith("/funding/"))) {
    return null
  }
  return path
}
