import { NUMERIC_TOOL_CONFIG, NumericToolCode, VariabilityLabel } from "./config"

export type AssessmentPoint = {
  date: string // ISO date
  score: number
  sessionIndex: number
}

export type AssessmentOverviewStats = {
  n: number
  min: number
  max: number
  mean: number
  median: number
  sd: number
  minBand: string
  maxBand: string
  meanBand: string
  medianBand: string
  variabilityLabel: VariabilityLabel
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export function sampleStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function computeOverviewStats(
  toolCode: NumericToolCode,
  points: AssessmentPoint[]
): AssessmentOverviewStats | null {
  if (points.length === 0) return null

  const config = NUMERIC_TOOL_CONFIG[toolCode]
  const scores = points.map((p) => p.score)

  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const meanScore = round(mean(scores))
  const medianScore = round(median(scores))
  const sd = round(sampleStandardDeviation(scores), 2)

  const variabilityLabel =
    config.variabilityBands.find((band) => sd <= band.maxSd)?.label ??
    "Considerable fluctuation"

  return {
    n: points.length,
    min: minScore,
    max: maxScore,
    mean: meanScore,
    median: medianScore,
    sd,
    minBand: config.severityFromScore(minScore),
    maxBand: config.severityFromScore(maxScore),
    meanBand: config.severityFromScore(Math.round(meanScore)),
    medianBand: config.severityFromScore(Math.round(medianScore)),
    variabilityLabel,
  }
}
