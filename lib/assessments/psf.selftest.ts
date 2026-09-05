import assert from "node:assert/strict"

import {
  calculatePsfConcernScore,
  calculatePsfFeedbackTrend,
  calculatePsfScore,
  formatPsfSeverity,
  parsePsfSeverity,
} from "./psf"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

// --- parsePsfSeverity: round-trips formatPsfSeverity's output -------------------------

check(
  "parsePsfSeverity round-trips formatPsfSeverity",
  parsePsfSeverity(formatPsfSeverity(calculatePsfScore([2, 1, -1, 2, -2]))),
  { positiveFeedback: 5, negativeFeedback: 3 }
)

check("parsePsfSeverity: null input", parsePsfSeverity(null), null)
check("parsePsfSeverity: undefined input", parsePsfSeverity(undefined), null)
check(
  "parsePsfSeverity: unrelated string doesn't match",
  parsePsfSeverity("Moderate"),
  null
)

// --- calculatePsfConcernScore: negative weighted 2x, positive 1x ----------------------

check("concern: all positive, no negative", calculatePsfConcernScore(10, 0), -10)
check("concern: all negative, no positive", calculatePsfConcernScore(0, 10), 20)
check("concern: balanced", calculatePsfConcernScore(5, 5), 5)
check("concern: no feedback at all", calculatePsfConcernScore(0, 0), 0)

// --- calculatePsfFeedbackTrend --------------------------------------------------------

check("trend: no sessions", calculatePsfFeedbackTrend([]), null)

check(
  "trend: single session equals its own concern score",
  calculatePsfFeedbackTrend([
    { date: "2026-01-01", positiveFeedback: 2, negativeFeedback: 6 },
  ]),
  calculatePsfConcernScore(2, 6)
)

{
  // Order-independence: passing sessions newest-first (as the table displays them)
  // must give the same trend as passing them oldest-first, since the function sorts
  // internally.
  const oldestFirst = [
    { date: "2026-01-01", positiveFeedback: 10, negativeFeedback: 0 }, // concern -10
    { date: "2026-02-01", positiveFeedback: 0, negativeFeedback: 10 }, // concern 20
  ]
  const newestFirst = [...oldestFirst].reverse()

  const trendOldestFirst = calculatePsfFeedbackTrend(oldestFirst)
  const trendNewestFirst = calculatePsfFeedbackTrend(newestFirst)

  check(
    "trend: input order doesn't matter",
    trendNewestFirst,
    trendOldestFirst
  )

  // EWMA by hand with default smoothing 0.4: start at -10 (first session's concern),
  // then blend in the second session's concern of 20 at 40%.
  const expected = 0.4 * 20 + 0.6 * -10
  check("trend: matches hand-computed EWMA", trendOldestFirst, expected)
}

{
  // A single bad (high-concern) session pulls the trend up immediately...
  const goodThenBad = [
    { date: "2026-01-01", positiveFeedback: 10, negativeFeedback: 0 },
    { date: "2026-01-08", positiveFeedback: 10, negativeFeedback: 0 },
    { date: "2026-01-15", positiveFeedback: 10, negativeFeedback: 0 },
    { date: "2026-01-22", positiveFeedback: 0, negativeFeedback: 10 },
  ]
  const trendAfterBadSession = calculatePsfFeedbackTrend(goodThenBad)!
  assert.ok(
    trendAfterBadSession > -10,
    "trend: a bad session raises the trend above a flat run of good ones"
  )
  console.log("ok — trend: a bad session raises the trend above a flat run of good ones")

  // ...but a further good session afterwards brings it back down again (not stuck high).
  const thenGoodAgain = [
    ...goodThenBad,
    { date: "2026-01-29", positiveFeedback: 10, negativeFeedback: 0 },
  ]
  const trendAfterRecovery = calculatePsfFeedbackTrend(thenGoodAgain)!
  assert.ok(
    trendAfterRecovery < trendAfterBadSession,
    "trend: a subsequent good session brings the trend back down"
  )
  console.log("ok — trend: a subsequent good session brings the trend back down")
}

console.log("All psf selftest checks passed.")
