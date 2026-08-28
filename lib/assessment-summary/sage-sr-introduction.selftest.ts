import assert from "node:assert/strict"

import { buildSageSrIntroductionSection } from "./sage-sr-introduction"

function assertEqual(name: string, actual: unknown, expected: unknown) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

// Real Test01 evaluation dates (confirmed against the actual fixture PDFs):
// Core 8/9/2026, Background 8/10/2026, Personality 8/11/2026.
const CORE_DATE = new Date("2026-08-09T00:00:00+10:00")
const BACKGROUND_DATE = new Date("2026-08-10T00:00:00+10:00")
const PERSONALITY_DATE = new Date("2026-08-11T00:00:00+10:00")
const GENERATED_AT = new Date("2026-08-28T09:00:00+10:00")

assertEqual(
  "all three modules, real Test01 dates and Core metrics, printed-order regardless of input order",
  buildSageSrIntroductionSection({
    imports: [
      { module: "personality", evaluationDate: PERSONALITY_DATE },
      { module: "core", evaluationDate: CORE_DATE },
      { module: "background", evaluationDate: BACKGROUND_DATE },
    ],
    reportGeneratedAt: GENERATED_AT,
    coreMetrics: { reliabilityItemsCorrect: "5/5", durationMinutes: 26, itemsSkipped: "No items skipped" },
  }),
  "This report synthesizes the client's SAGE-SR Core, Background, and Personality module results. " +
    "Core was completed on 9 Aug 2026, Background was completed on 10 Aug 2026, and Personality was completed on 11 Aug 2026. " +
    "The Core module took 26 minutes to complete. 5/5 reliability items were answered correctly. No items skipped. " +
    "This report was generated on 28 Aug 2026."
)

assertEqual(
  "coreMetrics present but Core not actually imported → metrics sentences suppressed (assembler-contract guard)",
  buildSageSrIntroductionSection({
    imports: [{ module: "background", evaluationDate: BACKGROUND_DATE }],
    reportGeneratedAt: GENERATED_AT,
    coreMetrics: { reliabilityItemsCorrect: "5/5", durationMinutes: 26, itemsSkipped: "No items skipped" },
  }),
  "This report synthesizes the client's SAGE-SR Background module results. " +
    "Background was completed on 10 Aug 2026. " +
    "This report was generated on 28 Aug 2026."
)

assertEqual(
  "Core only (the minimum to generate this report), no metrics box present",
  buildSageSrIntroductionSection({
    imports: [{ module: "core", evaluationDate: CORE_DATE }],
    reportGeneratedAt: GENERATED_AT,
  }),
  "This report synthesizes the client's SAGE-SR Core module results. " +
    "Core was completed on 9 Aug 2026. " +
    "This report was generated on 28 Aug 2026."
)

assertEqual(
  "no modules imported → null (defensive; shouldn't happen in practice)",
  buildSageSrIntroductionSection({ imports: [], reportGeneratedAt: GENERATED_AT }),
  null
)

console.log("\nAll sage-sr-introduction selftests passed.")
