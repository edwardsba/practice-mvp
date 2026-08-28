import assert from "node:assert/strict"

import { buildSageSrExclusionClauseSection } from "./sage-sr-exclusion-clause"

function assertEqual(name: string, actual: unknown, expected: unknown) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

// Static, generic paragraph — same text every call, no arguments. The exact wording
// is pinned here deliberately: any change to this caveat's substance should be a
// conscious edit to this expected string, not a silent drift.
assertEqual(
  "returns the fixed exclusion-clause caveat, unchanged across calls",
  buildSageSrExclusionClauseSection(),
  "The diagnoses and symptom patterns described in this report are based on the " +
    "client's self-reported answers to the SAGE-SR assessment, scored against DSM-5-TR " +
    "criteria. This report does not represent a completed differential diagnosis: it has " +
    "not been checked against DSM-5-TR's exclusion criteria, such as whether a " +
    "presentation is better explained by another medical condition, the effects of a " +
    "substance, or another mental disorder, and it does not incorporate clinical history, " +
    "collateral information, or examination findings outside this self-report instrument. " +
    "These findings should be reviewed and integrated with the treating clinician's own " +
    "assessment before any diagnosis is confirmed."
)

assertEqual(
  "calling it twice returns the identical string (pure, no hidden state)",
  buildSageSrExclusionClauseSection(),
  buildSageSrExclusionClauseSection()
)

console.log("\nAll sage-sr-exclusion-clause selftests passed.")
