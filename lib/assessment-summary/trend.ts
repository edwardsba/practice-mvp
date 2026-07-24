import { AssessmentPoint } from "./stats"

export type TrendShape =
  | "linear_increasing"
  | "linear_decreasing"
  | "linear_flat"
  | "dip"
  | "peak"
  | "no_pattern"

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
 * Classifies the shape of a small (typically n=2-6) assessment score series.
 *
 * n = 2: two points always form a perfect line — classified directly by
 * comparing the two scores (flat / increasing / decreasing), no regression
 * needed, and no ambiguity possible.
 *
 * n >= 3, in order:
 * Step 1: fit a straight line. If it explains at least half the variation
 * (R² >= 0.5), call it a genuine linear trend (increasing/decreasing).
 * Step 2: otherwise, compare the average of the interior points against the
 * average of the two endpoints. If the interior deviates by at least one SD,
 * call it a "dip" (interior lower) or "peak" (interior higher). This must
 * run before Step 3, since a genuine dip/peak often has a near-zero overall
 * slope too, and dip/peak is the more informative label when it applies.
 * Step 3: otherwise, split on the fitted slope across ALL points (never just
 * the endpoints — see below) into "linear_flat" (small overall slope,
 * whatever session-to-session noise exists) or "no_pattern" (a slope too
 * large to ignore, but too poor a linear fit to count as Step 1's genuine
 * trend).
 *
 * Step 3 deliberately uses the regression slope, not a comparison of the
 * first and last score. A sequence like [10, 20, 3, 11] has similar
 * first/last values but a real downward slope (-1.4/session) once fit
 * across all four points — the big swing through the middle is exactly what
 * an endpoints-only check would miss, wrongly calling a real decline "flat."
 *
 * With only 3-6 points a full curve-fit (e.g. quadratic regression) risks
 * overfitting - a quadratic through 4 points fits almost perfectly by
 * construction regardless of whether there's a real pattern. This heuristic
 * avoids that.
 *
 * `maxScore` scales the flat-vs-no_pattern threshold (10% of maxScore)
 * consistently across tools with very different scales (e.g. PHQ-9's 27 vs
 * BTP's 5).
 */
export function classifyTrend(
  points: AssessmentPoint[],
  maxScore: number
): TrendShape {
  if (points.length < 2) return "linear_flat"

  const sorted = [...points].sort((a, b) => a.sessionIndex - b.sessionIndex)
  const scores = sorted.map((p) => p.score)

  if (scores.length === 2) {
    if (scores[1] === scores[0]) return "linear_flat"
    return scores[1] > scores[0] ? "linear_increasing" : "linear_decreasing"
  }

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

  const flatThreshold = maxScore * 0.1
  const lineImpliedChange = slope * (idx[idx.length - 1] - idx[0])

  return Math.abs(lineImpliedChange) < flatThreshold ? "linear_flat" : "no_pattern"
}
