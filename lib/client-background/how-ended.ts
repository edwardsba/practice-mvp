export const HOW_ENDED = ["separated", "divorced", "partner_died", "other"] as const
export type HowEnded = (typeof HOW_ENDED)[number]

export const HOW_ENDED_LABELS: Record<HowEnded, string> = {
  separated: "Separated",
  divorced: "Divorced",
  partner_died: "Partner died",
  other: "Other (describe)",
}

/**
 * Maps free-text "How it ended" onto the coded list.
 * separat* → Separated, divorc* → Divorced, died / death / widow* → Partner died.
 * Anything else is Other and the original text is kept as the description.
 */
export function mapHowEnded(text: string): { howEnded: HowEnded | ""; detail: string } {
  const value = text.trim()
  if (!value) return { howEnded: "", detail: "" }
  if (/separat/i.test(value)) return { howEnded: "separated", detail: value }
  if (/divorc/i.test(value)) return { howEnded: "divorced", detail: value }
  if (/widow|died|death/i.test(value)) return { howEnded: "partner_died", detail: value }
  return { howEnded: "other", detail: value }
}
