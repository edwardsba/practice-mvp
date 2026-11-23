import { safeReturnTo } from "@/lib/navigation/safe-return-to"

export function resolveBackNavigation(
  returnTo: string | undefined,
  defaultHref: string,
  defaultLabel: string
): { href: string; label: string } {
  const safe = safeReturnTo(returnTo)
  if (!safe) {
    return { href: defaultHref, label: defaultLabel }
  }

  return { href: safe, label: labelForReturnTo(safe, defaultLabel) }
}

function labelForReturnTo(returnTo: string, defaultLabel: string): string {
  if (returnTo.startsWith("/session-notes/")) {
    return "← Back to session note"
  }
  if (returnTo === "/session-notes") {
    return "← Back to session notes"
  }
  if (returnTo.startsWith("/clients/")) {
    if (/^\/clients\/[^/]+\/appointments$/.test(returnTo)) {
      return "← Back to appointments"
    }
    if (/^\/clients\/[^/]+\/reports$/.test(returnTo)) {
      return "← Back to reports"
    }
    if (/^\/clients\/[^/]+\/claims$/.test(returnTo)) {
      return "← Back to claims"
    }
    if (/^\/clients\/[^/]+\/background\/interview/.test(returnTo)) {
      return "← Back to interview"
    }
    if (/^\/clients\/[^/]+\/background$/.test(returnTo)) {
      return "← Back to background"
    }
    return "← Back to client"
  }
  if (returnTo === "/appointments" || returnTo.startsWith("/appointments/")) {
    return "← Back to appointments"
  }
  if (returnTo === "/calendar") {
    return "← Back to calendar"
  }
  if (returnTo.startsWith("/contacts/professionals")) {
    return "← Back to professional"
  }
  if (returnTo.startsWith("/funding/approvals/")) {
    return "← Back to funding approval"
  }
  if (returnTo === "/funding/approvals") {
    return "← Back to funding approvals"
  }
  return defaultLabel
}

export function appendReturnTo(href: string, returnTo: string): string {
  const separator = href.includes("?") ? "&" : "?"
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`
}
