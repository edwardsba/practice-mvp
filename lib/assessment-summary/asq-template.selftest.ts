import assert from "node:assert/strict"

import { buildAsqSummarySentence, AsqResultForSummary } from "./asq-template"

function results(
  entries: { recentPositive: boolean; currentPositive: boolean }[]
): AsqResultForSummary[] {
  return entries.map((e, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    ...e,
  }))
}

function check(name: string, actual: string | null, expected: string | null) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

check("zero submissions → null", buildAsqSummarySentence([]), null)

check(
  "all negative, n=4",
  buildAsqSummarySentence(
    results([
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
    ])
  ),
  "The client denied any thoughts of self-harm across all 4 ASQ submissions during this period."
)

check(
  "all recent-only, n=4 (new collapse)",
  buildAsqSummarySentence(
    results([
      { recentPositive: true, currentPositive: false },
      { recentPositive: true, currentPositive: false },
      { recentPositive: true, currentPositive: false },
      { recentPositive: true, currentPositive: false },
    ])
  ),
  "The client reported recent thoughts of suicide without current thoughts across all 4 ASQ submissions during this period."
)

check(
  "all current-positive, n=6 (new collapse)",
  buildAsqSummarySentence(
    results([
      { recentPositive: false, currentPositive: true },
      { recentPositive: true, currentPositive: true },
      { recentPositive: false, currentPositive: true },
      { recentPositive: false, currentPositive: true },
      { recentPositive: true, currentPositive: true },
      { recentPositive: false, currentPositive: true },
    ])
  ),
  "The client reported current thoughts of suicide across all 6 ASQ submissions during this period."
)

check(
  "mix: negative + current only, recent-only clause dropped (n=4)",
  buildAsqSummarySentence(
    results([
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: true },
    ])
  ),
  "Of the 4 ASQ submissions during this period, the client denied any thoughts of self-harm on 3 occasions and reported current thoughts of suicide on 1 occasion."
)

check(
  "mix: negative + recent-only, current clause dropped (n=4)",
  buildAsqSummarySentence(
    results([
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: true, currentPositive: false },
      { recentPositive: true, currentPositive: false },
    ])
  ),
  "Of the 4 ASQ submissions during this period, the client denied any thoughts of self-harm on 2 occasions and reported recent thoughts of suicide without current thoughts on 2 occasions."
)

check(
  "mix: recent-only + current, negative clause dropped (n=6)",
  buildAsqSummarySentence(
    results([
      { recentPositive: true, currentPositive: false },
      { recentPositive: true, currentPositive: false },
      { recentPositive: true, currentPositive: false },
      { recentPositive: false, currentPositive: true },
      { recentPositive: true, currentPositive: true },
      { recentPositive: false, currentPositive: true },
    ])
  ),
  "Of the 6 ASQ submissions during this period, the client reported recent thoughts of suicide without current thoughts on 3 occasions and reported current thoughts of suicide on 3 occasions."
)

check(
  "genuine mix, all three present (n=6)",
  buildAsqSummarySentence(
    results([
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: true, currentPositive: false },
      { recentPositive: false, currentPositive: true },
      { recentPositive: true, currentPositive: true },
      { recentPositive: false, currentPositive: true },
    ])
  ),
  "Of the 6 ASQ submissions during this period, the client denied any thoughts of self-harm on 2 occasions, reported recent thoughts of suicide without current thoughts on 1 occasion, and reported current thoughts of suicide on 3 occasions."
)

check(
  "single occurrence uses singular 'occasion' (n=4)",
  buildAsqSummarySentence(
    results([
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: false },
      { recentPositive: false, currentPositive: true },
    ])
  ),
  "Of the 4 ASQ submissions during this period, the client denied any thoughts of self-harm on 3 occasions and reported current thoughts of suicide on 1 occasion."
)

console.log("\nAll ASQ summary sentence checks passed.")
