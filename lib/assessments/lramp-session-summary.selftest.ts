import assert from "node:assert/strict"

import { LRAMP_ELEMENTS } from "@/lib/assessments/definitions/lramp"
import { lrampSessionSummaryLine } from "@/lib/assessments/lramp-session-summary"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check(
  "F1=a + F2 next individual",
  lrampSessionSummaryLine(LRAMP_ELEMENTS, {
    lramp_f1: ["a"],
    lramp_f2: ["next_individual_session"],
  }),
  "A. Not imminently dangerous · Re-evaluate: Next individual session"
)

check(
  "F1=c + multiple F2",
  lrampSessionSummaryLine(LRAMP_ELEMENTS, {
    lramp_f1: ["c"],
    lramp_f2: ["12_hours", "24_hours"],
  }),
  "C. Emergency intervention needed · Re-evaluate: 12 hours, 24 hours"
)

check(
  "F1 only, no F2",
  lrampSessionSummaryLine(LRAMP_ELEMENTS, { lramp_f1: ["b"] }),
  "B. Some imminent danger"
)

check(
  "missing F1 → null",
  lrampSessionSummaryLine(LRAMP_ELEMENTS, {}),
  null
)

console.log("lramp-session-summary.selftest.ts: ok")
