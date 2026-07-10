import { formatShortDate } from "@/lib/reports/format-date"

export type AsqResultForSummary = {
  date: string
  recentPositive: boolean
  currentPositive: boolean
}

/**
 * Builds the ASQ results summary for the progress report Risk section.
 * Uses Recent (Q1–3) and Current (Q5) flags per submission in the
 * reporting period — Historical (Q4) is handled separately in self-harm history.
 */
export function buildAsqSummarySentence(
  results: AsqResultForSummary[]
): string | null {
  if (results.length === 0) return null

  const sorted = [...results].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const total = sorted.length
  const recentOnly = sorted.filter((r) => r.recentPositive && !r.currentPositive)
  const currentPositive = sorted.filter((r) => r.currentPositive)
  const negative = sorted.filter((r) => !r.recentPositive && !r.currentPositive)

  if (negative.length === total) {
    return `The client denied any thoughts of self-harm across all ${total} ASQ submissions during this period.`
  }

  const sentence1 =
    `Of the ${total} ASQ submissions during this period, the client denied any thoughts of self-harm on ` +
    `${negative.length} occasion${negative.length === 1 ? "" : "s"}, reported recent thoughts of suicide ` +
    `without current thoughts on ${recentOnly.length} occasion${recentOnly.length === 1 ? "" : "s"}, and ` +
    `reported current thoughts of suicide on ${currentPositive.length} occasion${currentPositive.length === 1 ? "" : "s"}.`

  const sentences = [sentence1]

  if (recentOnly.length > 0) {
    const dates = recentOnly.map((r) => formatShortDate(r.date)).join(", ")
    sentences.push(
      `Recent thoughts of suicide, without current thoughts, were recorded on ${dates}.`
    )
  }

  if (currentPositive.length > 0) {
    const dates = currentPositive.map((r) => formatShortDate(r.date)).join(", ")
    sentences.push(`Current thoughts of suicide were recorded on ${dates}.`)
  }

  return sentences.join(" ")
}
