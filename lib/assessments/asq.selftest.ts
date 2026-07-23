import assert from "node:assert/strict"

import { asqScreenOutcome } from "./asq"

function check(
  name: string,
  flags: { historicalPositive: boolean; recentPositive: boolean; currentPositive: boolean },
  expected: string
) {
  const actual = asqScreenOutcome(flags)
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

check(
  "1: no history, no recent, no current",
  { historicalPositive: false, recentPositive: false, currentPositive: false },
  "No history or TOSH"
)
check(
  "2: historical only",
  { historicalPositive: true, recentPositive: false, currentPositive: false },
  "Historical attempt, no TOSH"
)
check(
  "3: historical + recent, no current",
  { historicalPositive: true, recentPositive: true, currentPositive: false },
  "Historical attempt, recent no current TOSH"
)
check(
  "4: historical + recent + current",
  { historicalPositive: true, recentPositive: true, currentPositive: true },
  "Historical attempt, recent and current TOSH"
)
check(
  "5: recent only, no current",
  { historicalPositive: false, recentPositive: true, currentPositive: false },
  "Recent no current TOSH"
)
check(
  "6: recent + current, no historical",
  { historicalPositive: false, recentPositive: true, currentPositive: true },
  "Recent and current TOSH"
)
check(
  "7: current only",
  { historicalPositive: false, recentPositive: false, currentPositive: true },
  "Current TOSH"
)
check(
  "8: historical + current, no recent",
  { historicalPositive: true, recentPositive: false, currentPositive: true },
  "Historical attempt, current TOSH"
)

console.log("\nAll 8 ASQ severity states passed.")
