import { BTP_TOOL_CONFIG } from "./config"
import { computeGenericOverviewStats } from "./stats"
import { classifyTrend } from "./trend"
import { buildVariabilityPatternSentence } from "./templates"
import {
  classifySeverityPattern,
  buildSeveritySentence,
} from "./severity-pattern"
import type { AssessmentPoint } from "./stats"
import type { BtpReportResultRow } from "@/lib/reports/snapshot"

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

    const trendShape = classifyTrend(points)
    const variabilityPatternSentence = buildVariabilityPatternSentence(
      stats.variabilityLabel,
      trendShape,
      "ratings"
    )

    const bands = points.map((p) => config.ratingFromScore(p.score))
    const severityCase = classifySeverityPattern(
      bands,
      config.bandOrder,
      config.bottomTwoBands,
      config.topTwoBands
    )
    const severitySentence = buildSeveritySentence(severityCase, "rating")

    output.push({
      target,
      paragraph: [overviewSentence, variabilityPatternSentence, severitySentence].join(" "),
    })
  }

  return output
}
