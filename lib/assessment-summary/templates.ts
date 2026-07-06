import { NUMERIC_TOOL_CONFIG, NumericToolCode } from "./config"
import { AssessmentPoint, computeOverviewStats } from "./stats"
import { classifyTrend, TrendShape } from "./trend"

const TREND_SENTENCES: Record<
  TrendShape,
  (toolName: string, symptomDomain: string) => string
> = {
  linear_decreasing: (toolName, symptomDomain) =>
    `${toolName} scores showed a consistent downward trend across the referral period, suggesting a gradual reduction in ${symptomDomain} over time.`,
  linear_increasing: (toolName, symptomDomain) =>
    `${toolName} scores showed a consistent upward trend across the referral period, suggesting a gradual increase in ${symptomDomain} over time.`,
  dip: (toolName, symptomDomain) =>
    `${toolName} scores were lower mid-way through the referral period compared to the beginning and end, suggesting a period of improvement in ${symptomDomain} that was not sustained.`,
  peak: (toolName, symptomDomain) =>
    `${toolName} scores were higher mid-way through the referral period compared to the beginning and end, suggesting a temporary increase in ${symptomDomain} before returning toward baseline.`,
  flat: (toolName) =>
    `${toolName} scores remained relatively stable across the referral period, with no clear upward or downward trend.`,
}

const VARIABILITY_SENTENCES: Record<string, (symptomDomain: string) => string> = {
  Consistent: (symptomDomain) =>
    `These scores indicate a relatively consistent level of ${symptomDomain} across the referral period.`,
  "Some fluctuation": (symptomDomain) =>
    `These scores indicate some fluctuation in ${symptomDomain} across the referral period.`,
  "Considerable fluctuation": (symptomDomain) =>
    `These scores demonstrate considerable fluctuation in ${symptomDomain} across the referral period.`,
}

/**
 * Builds the 3-sentence automated summary paragraph for a numeric tool
 * (PHQ-9, GAD-7, ASSIST). Returns null if there are no results in the period.
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

  const variabilitySentence = VARIABILITY_SENTENCES[stats.variabilityLabel](
    config.symptomDomain
  )

  const trendShape = classifyTrend(points)
  const trendSentence = TREND_SENTENCES[trendShape](
    config.toolName,
    config.symptomDomain
  )

  return [overviewSentence, variabilitySentence, trendSentence].join(" ")
}
