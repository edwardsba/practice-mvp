function formatShortDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export type AsqResultForSummary = {
  date: string
  acuteRiskRating: string | null
}

/**
 * Builds the ASQ summary sentence. ASQ is categorical (Negative screen /
 * Non-acute positive screen / Acute positive screen) and does NOT go through
 * the numeric mean/SD/trend pipeline - see lib/assessments/asq.ts for how
 * acuteRiskRating is derived.
 *
 * Important: a lifetime-history item (Q4, "have you ever tried to kill
 * yourself") can produce a "Non-acute positive screen" indefinitely, even
 * decades after the fact, without indicating current risk. The sentence
 * always uses the full qualified label (e.g. "non-acute positive screen"),
 * never a bare "positive", to avoid misreading this as an acute concern.
 */
export function buildAsqSummarySentence(
  results: AsqResultForSummary[]
): string | null {
  if (results.length === 0) return null

  const sorted = [...results].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const positives = sorted.filter(
    (r) => r.acuteRiskRating && r.acuteRiskRating !== "Negative screen"
  )

  const intro = `The client completed the ASQ on ${sorted.length} occasion${
    sorted.length === 1 ? "" : "s"
  } during the referral period.`

  if (positives.length === 0) {
    return `${intro} All screens were negative for suicide risk indicators.`
  }

  const mostRecent = sorted[sorted.length - 1]
  const positiveDates = positives.map((r) => formatShortDate(r.date)).join(", ")
  const mostRecentLabel = (mostRecent.acuteRiskRating ?? "").toLowerCase()

  return (
    `${intro} The client screened positive on ${positiveDates}; the most recent ` +
    `screen (${formatShortDate(mostRecent.date)}) was a ${mostRecentLabel}.`
  )
}
