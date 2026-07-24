import assert from "node:assert/strict"

import { classifyTrend } from "./trend"
import { AssessmentPoint } from "./stats"

function pts(scores: number[]): AssessmentPoint[] {
  return scores.map((score, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    score,
    sessionIndex: i + 1,
  }))
}

function check(name: string, actual: string, expected: string) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

// n=2 cases — always a perfect line, never "flat" by default anymore.
check("n=2, increasing", classifyTrend(pts([8, 14]), 27), "linear_increasing")
check("n=2, decreasing", classifyTrend(pts([14, 8]), 27), "linear_decreasing")
check("n=2, equal", classifyTrend(pts([10, 10]), 27), "linear_flat")

// n>=3 strong linear trend
check(
  "n=4, smooth rise (r2=0.98)",
  classifyTrend(pts([8, 10, 12, 13]), 27),
  "linear_increasing"
)
check(
  "n=4, smooth fall",
  classifyTrend(pts([20, 16, 12, 9]), 27),
  "linear_decreasing"
)

// dip / peak
check(
  "n=4, dip (interior well below endpoints)",
  classifyTrend(pts([20, 5, 5, 20]), 27),
  "dip"
)
check(
  "n=4, peak (interior well above endpoints)",
  classifyTrend(pts([5, 20, 20, 5]), 27),
  "peak"
)

// linear_flat vs no_pattern — the core fix from today
check(
  "n=4, steady with tiny wobble -> linear_flat",
  classifyTrend(pts([10, 12, 9, 11]), 27),
  "linear_flat"
)
check(
  "n=4, big bounces but net-zero slope across all points -> linear_flat",
  classifyTrend(pts([8, 14, 7, 13]), 27),
  "linear_flat"
)
check(
  "n=4, wild swings with real net drift -> no_pattern",
  classifyTrend(pts([5, 20, 8, 22]), 27),
  "no_pattern"
)
check(
  "n=4, similar endpoints but real slope through the middle -> no_pattern (regression test for the endpoints-only bug)",
  classifyTrend(pts([10, 20, 3, 11]), 27),
  "no_pattern"
)

console.log("\nAll trend classification checks passed.")
