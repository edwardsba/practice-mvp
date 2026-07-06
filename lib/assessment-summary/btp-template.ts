import { BTP_TOOL_CONFIG } from "./config"
import { computeGenericOverviewStats } from "./stats"
import { classifyTrend, TrendShape } from "./trend"
import type { AssessmentPoint } from "./stats"
import type { BtpReportResultRow } from "@/lib/reports/snapshot"

const TREND_SENTENCES_BTP: Record<TrendShape, (domain: string) => string> = {
  linear_increasing: (domain) =>
    `Ratings for this target showed a consistent upward trend across the referral period, suggesting the client's ${domain} improved over time.`,
  linear_decreasing: (domain) =>
    `Ratings for this target showed a consistent downward trend across the referral period, suggesting the client's ${domain} declined over time.`,
  dip: (domain) =>
    `Ratings for this target were lower mid-way through the referral period compared to the beginning and end, suggesting a temporary decline in ${domain} that was not sustained.`,
  peak: (domain) =>
    `Ratings for this target were higher mid-way through the referral period compared to the beginning and end, suggesting a temporary improvement in ${domain} before returning toward baseline.`,
  flat: (domain) =>
    `Ratings for this target did not show a consistent upward or downward trend in ${domain} across the referral period.`,
}

const VARIABILITY_SENTENCES: Record<string, (domain: string) => string> = {
  Consistent: (domain) =>
    `These ratings indicate a relatively consistent level of ${domain} across the referral period.`,
  "Some fluctuation": (domain) =>
    `These ratings indicate some fluctuation in ${domain} across the referral period.`,
  "Considerable fluctuation": (domain) =>
    `These ratings demonstrate considerable fluctuation in ${domain} across the referral period.`,
}

function pivotByTarget(
  results: BtpReportResultRow[]
): Map<string, AssessmentPoint[]> {
  const map = new Map<string, { date: string; score: number }[]>()
  for (const result of results) {
    for (const t of result.targets) {
      const rows = map.get(t.target) ?? []
      rows.push({ date: result.date, score: t.score })
      map.set(t.target, rows)
    }
  }

  const withIndex = new Map<string, AssessmentPoint[]>()
  for (const [target, rows] of map.entries()) {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    withIndex.set(
      target,
      sorted.map((r, i) => ({ date: r.date, score: r.score, sessionIndex: i + 1 }))
    )
  }
  return withIndex
}

/**
 * Builds one summary paragraph per behavioural target (a client may have more
 * than one target running at once, each rated separately).
 */
export function buildBtpSummaryParagraphs(
  results: BtpReportResultRow[]
): { target: string; paragraph: string }[] {
  const byTarget = pivotByTarget(results)
  const config = BTP_TOOL_CONFIG
  const output: { target: string; paragraph: string }[] = []

  for (const [target, points] of byTarget.entries()) {
    const stats = computeGenericOverviewStats(points, config.variabilityBands)
    if (!stats) continue

    const overviewSentence =
      `For the behavioural target "${target}", the client rated their effectiveness between ` +
      `${stats.min}/${config.maxScore} (${config.ratingFromScore(stats.min)}) and ` +
      `${stats.max}/${config.maxScore} (${config.ratingFromScore(stats.max)}) across the referral period, ` +
      `with a mean rating of ${stats.mean}/${config.maxScore} (${config.ratingFromScore(Math.round(stats.mean))}) ` +
      `and a median rating of ${stats.median}/${config.maxScore} (n = ${stats.n}).`

    const variabilitySentence = VARIABILITY_SENTENCES[stats.variabilityLabel](
      config.symptomDomain
    )

    const trendShape = classifyTrend(points)
    const trendSentence = TREND_SENTENCES_BTP[trendShape](config.symptomDomain)

    output.push({
      target,
      paragraph: [overviewSentence, variabilitySentence, trendSentence].join(" "),
    })
  }

  return output
}
