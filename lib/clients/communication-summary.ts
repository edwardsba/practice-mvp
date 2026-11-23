export type CommunicationPreferencesInput = {
  commsOptOut: boolean
  reminderOptOut: boolean
  preSessionOptOut: boolean
  postSessionOptOut: boolean
  adminCommsOptOut: boolean
  onlineBookingPermitted: boolean
}

/**
 * One-line Communication summary for the Contact details panel.
 */
export function formatCommunicationSummary(
  prefs: CommunicationPreferencesInput
): string {
  const booking = prefs.onlineBookingPermitted
    ? "Online booking permitted"
    : "Online booking not permitted"

  if (prefs.commsOptOut) {
    return "Opted out of all contact"
  }

  const optedOut: string[] = []
  if (prefs.reminderOptOut) optedOut.push("reminder emails")
  if (prefs.preSessionOptOut) optedOut.push("pre-session emails")
  if (prefs.postSessionOptOut) optedOut.push("post-session emails")
  if (prefs.adminCommsOptOut) optedOut.push("admin emails")

  const emailsPart =
    optedOut.length === 0
      ? "All emails on"
      : `Opted out: ${optedOut.join(", ")}`

  return `${emailsPart} · ${booking}`
}
