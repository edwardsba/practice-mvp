export type AsqResultForSummary = {
  date: string
  recentPositive: boolean
  currentPositive: boolean
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 1) return clauses[0]
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`
}

/**
 * Builds the ASQ results summary for the progress report Risk section.
 * Uses Recent (Q1–3) and Current (Q5) flags per submission in the
 * reporting period — Historical (Q4) is handled separately in self-harm
 * history, not here.
 *
 * Three shapes:
 * - All submissions in one category (all negative / all recent-only / all
 *   current-positive): a single collapsed sentence, no follow-up.
 * - A genuine mix across two or three categories: one sentence listing only
 *   the categories that actually occurred (zero-count categories are
 *   omitted entirely).
 * No sentence lists dates — the Progress Report's Assessment Data appendix
 * already has a full dated table for anyone who needs exact dates.
 */
export function buildAsqSummarySentence(
  results: AsqResultForSummary[]
): string | null {
  if (results.length === 0) return null

  const total = results.length
  const recentOnly = results.filter((r) => r.recentPositive && !r.currentPositive)
  const currentPositive = results.filter((r) => r.currentPositive)
  const negative = results.filter((r) => !r.recentPositive && !r.currentPositive)

  if (negative.length === total) {
    return `The client denied any thoughts of self-harm across all ${total} ASQ submissions during this period.`
  }

  if (recentOnly.length === total) {
    return `The client reported recent thoughts of suicide without current thoughts across all ${total} ASQ submissions during this period.`
  }

  if (currentPositive.length === total) {
    return `The client reported current thoughts of suicide across all ${total} ASQ submissions during this period.`
  }

  const clauses: string[] = []
  if (negative.length > 0) {
    clauses.push(
      `denied any thoughts of self-harm on ${negative.length} occasion${negative.length === 1 ? "" : "s"}`
    )
  }
  if (recentOnly.length > 0) {
    clauses.push(
      `reported recent thoughts of suicide without current thoughts on ${recentOnly.length} occasion${recentOnly.length === 1 ? "" : "s"}`
    )
  }
  if (currentPositive.length > 0) {
    clauses.push(
      `reported current thoughts of suicide on ${currentPositive.length} occasion${currentPositive.length === 1 ? "" : "s"}`
    )
  }

  return `Of the ${total} ASQ submissions during this period, the client ${joinClauses(clauses)}.`
}
