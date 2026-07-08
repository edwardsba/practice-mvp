import { NUMERIC_TOOL_CONFIG, NumericToolCode, VariabilityLabel } from "./config"
import type { ReportResultRow } from "@/lib/reports/snapshot"
import { AssessmentPoint, computeOverviewStats } from "./stats"
import { classifyTrend, TrendShape } from "./trend"
import {
  classifySeverityPattern,
  buildSeveritySentence,
  buildAssistSeveritySentence,
} from "./severity-pattern"

export function toAssessmentPoints(results: ReportResultRow[]): AssessmentPoint[] {
  const sorted = [...results].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  return sorted.map((r, i) => ({
    date: r.date,
    score: r.score,
    sessionIndex: i + 1,
  }))
}

/**
 * Merged Variability + Pattern sentence. When variability is Low, the
 * pattern shape is not surfaced separately - a near-zero-slope trend line and
 * low variability are effectively the same underlying condition, so one
 * simple sentence covers both. Medium/High variability combine the
 * variability level with the trend shape in one sentence.
 */
export function buildVariabilityPatternSentence(
  variabilityLabel: VariabilityLabel,
  trendShape: TrendShape,
  nounWord: "scores" | "ratings"
): string {
  if (variabilityLabel === "Consistent") {
    return `These ${nounWord} were relatively consistent.`
  }

  const variabilityWord =
    variabilityLabel === "Some fluctuation" ? "moderate" : "considerable"

  switch (trendShape) {
    case "linear_increasing":
      return `These ${nounWord} demonstrate ${variabilityWord} variability with an upward linear trend.`
    case "linear_decreasing":
      return `These ${nounWord} demonstrate ${variabilityWord} variability with a downward linear trend.`
    case "dip":
      return `These ${nounWord} demonstrate ${variabilityWord} variability, dipping midway through the referral period and then rising again.`
    case "peak":
      return `These ${nounWord} demonstrate ${variabilityWord} variability, peaking midway through the referral period and then dropping again.`
    case "flat":
      return `These ${nounWord} demonstrate ${variabilityWord} variability, with no consistent pattern across the referral period.`
  }
}

/**
 * Builds the 3-sentence automated summary paragraph for a numeric tool
 * (PHQ-9, GAD-7, ASSIST): overview, merged variability+pattern, severity.
 * Returns null if there are no results in the period.
 */
export function buildAssessmentSummaryParagraph(
  toolCode: NumericToolCode,
  points: AssessmentPoint[],
  clientFirstName: string
): string | null {
  if (points.length === 0) return null

  const config = NUMERIC_TOOL_CONFIG[toolCode]
  const stats = computeOverviewStats(toolCode, points)
  if (!stats) return null

  const overviewSentence =
    `${clientFirstName} reported ${config.toolName} scores between ` +
    `${stats.min}/${config.maxScore} (${stats.minBand}) and ${stats.max}/${config.maxScore} ` +
    `(${stats.maxBand}) across the referral period, with a mean score of ` +
    `${stats.mean}/${config.maxScore} (${stats.meanBand}) and a median score of ` +
    `${stats.median}/${config.maxScore} (${stats.medianBand}) (n = ${stats.n}).`

  const trendShape = classifyTrend(points)
  const variabilityPatternSentence = buildVariabilityPatternSentence(
    stats.variabilityLabel,
    trendShape,
    "scores"
  )

  const bands = points.map((p) => config.severityPatternBandFromScore(p.score))
  const severityCase = classifySeverityPattern(
    bands,
    config.bandOrder,
    config.bottomTwoBands,
    config.topTwoBands
  )
  const severitySentence =
    toolCode === "ASSIST"
      ? buildAssistSeveritySentence(severityCase)
      : buildSeveritySentence(severityCase, "severity rating")

  return [overviewSentence, variabilityPatternSentence, severitySentence].join(" ")
}
