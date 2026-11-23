import assert from "node:assert/strict"

import { emptyStressors } from "@/lib/client-background/types"
import { formatStressorsSummary } from "@/lib/clients/stressors-summary"

assert.equal(formatStressorsSummary(null), "None recorded")
assert.equal(formatStressorsSummary(undefined), "None recorded")
assert.equal(formatStressorsSummary(emptyStressors()), "None recorded")

assert.equal(
  formatStressorsSummary({ ...emptyStressors(), workStudy: "yes" }),
  "Work"
)

assert.equal(
  formatStressorsSummary({
    ...emptyStressors(),
    workStudy: "yes",
    financial: "yes",
  }),
  "Work, finances"
)

assert.equal(
  formatStressorsSummary({
    ...emptyStressors(),
    family: "yes",
    financial: "no",
    workStudy: "not_asked",
  }),
  "Family"
)

assert.equal(
  formatStressorsSummary({
    ...emptyStressors(),
    family: "yes",
    socialLife: "yes",
    financial: "yes",
  }),
  "Family, Social life, finances"
)

console.log("stressors-summary.selftest.ts: ok")
