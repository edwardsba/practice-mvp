import { AssessmentPoint } from "./stats"

export type TrendShape =
  | "linear_decreasing"
  | "linear_increasing"
  | "dip"
  | "peak"
  | "flat"

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function sampleStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function linearRegression(
  x: number[],
  y: number[]
): { slope: number; r2: number } {
  const meanX = mean(x)
  const meanY = mean(y)

  const numerator = x.reduce(
    (sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY),
    0
  )
  const denominator = x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0)

  if (denominator === 0) return { slope: 0, r2: 0 }

  const slope = numerator / denominator
  const intercept = meanY - slope * meanX

  const totalSS = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0)
  const residualSS = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept
    return sum + (yi - predicted) ** 2
  }, 0)

  const r2 = totalSS === 0 ? 0 : 1 - residualSS / totalSS

  return { slope, r2 }
}

/**
 * Classifies the shape of a small (typically n=4-6) assessment score series.
 *
 * Step 1: fit a straight line. If it explains at least half the variation
 * (R² >= 0.5), call it a genuine linear trend.
 *
 * Step 2: otherwise, compare the average of the interior points against the
 * average of the two endpoints. If the interior deviates by at least one SD,
 * call it a "dip" (interior lower) or "peak" (interior higher).
 *
 * Step 3: otherwise, flat/stable.
 *
 * With only 3-6 points a full curve-fit (e.g. quadratic regression) risks
 * overfitting - a quadratic through 4 points fits almost perfectly by
 * construction regardless of whether there's a real pattern. This heuristic
 * avoids that.
 */
export function classifyTrend(points: AssessmentPoint[]): TrendShape {
  if (points.length < 3) return "flat"

  const sorted = [...points].sort((a, b) => a.sessionIndex - b.sessionIndex)
  const scores = sorted.map((p) => p.score)
  const idx = sorted.map((p) => p.sessionIndex)

  const { slope, r2 } = linearRegression(idx, scores)

  if (r2 >= 0.5) {
    return slope < 0 ? "linear_decreasing" : "linear_increasing"
  }

  const sd = sampleStandardDeviation(scores)
  const n = scores.length
  const endpointAvg = (scores[0] + scores[n - 1]) / 2
  const interior = scores.slice(1, -1)
  const interiorAvg = interior.length ? mean(interior) : endpointAvg
  const interiorDeviation = interiorAvg - endpointAvg

  if (sd > 0 && Math.abs(interiorDeviation) >= sd) {
    return interiorDeviation < 0 ? "dip" : "peak"
  }

  return "flat"
}
