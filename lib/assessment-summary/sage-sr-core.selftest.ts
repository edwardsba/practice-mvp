import assert from "node:assert/strict"

import { buildSageSrCoreSection } from "./sage-sr-core"
import type { SageSrCoreParsedResult } from "@/lib/sage-sr/parse-core-clinician"

function assertEqual(name: string, actual: unknown, expected: unknown) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

function baseParsed(overrides: Partial<SageSrCoreParsedResult> = {}): SageSrCoreParsedResult {
  return {
    alerts: [],
    highConcernDiagnoses: [],
    endorsedSymptomsByDiagnosis: [],
    furtherEvaluationSymptomsByDiagnosis: [],
    absentOrMinimalDiagnoses: [],
    metrics: { reliabilityItemsCorrect: null, durationMinutes: null, itemsSkipped: null },
    ...overrides,
  }
}

// --- Alerts ---

assertEqual(
  "alerts: real Test01 flagged items, flat statement, no interpretation",
  buildSageSrCoreSection(
    baseParsed({ alerts: ["Felt depressed", "Recent panic attacks", "Felt hopeless", "Thoughts of ending life"] })
  ).alertsSentence,
  "The following items were flagged during screening: felt depressed, recent panic attacks, felt hopeless, and thoughts of ending life."
)

assertEqual("alerts: none raised → null", buildSageSrCoreSection(baseParsed()).alertsSentence, null)

// --- Tier 1: matched heading, Core's own approved formula (not Personality's) ---

{
  const section = buildSageSrCoreSection(
    baseParsed({
      highConcernDiagnoses: [{ label: "Generalized Anxiety Disorder", icd10Code: "F41.1" }],
      endorsedSymptomsByDiagnosis: [
        { diagnosis: "Generalized Anxiety Disorder", symptoms: ["Worried", "Anxious", "Poor sleep"] },
      ],
    })
  )
  assertEqual("tier 1: one paragraph produced", section.paragraphs.length, 1)
  assertEqual(
    "tier 1: uses Core's own 'meets full diagnostic criteria' formula with printed code",
    section.paragraphs[0].paragraph,
    "The client reports having symptoms that meet full diagnostic criteria for: Generalized Anxiety Disorder (F41.1), including worried, anxious, and poor sleep."
  )
}

// --- Tier 1: symptom-heading text differs from table label (real Test01 case) ---

{
  const section = buildSageSrCoreSection(
    baseParsed({
      highConcernDiagnoses: [{ label: "Major Depressive Episode", icd10Code: null }],
      endorsedSymptomsByDiagnosis: [
        { diagnosis: "Current Major Depressive Episode", symptoms: ["Sadness", "Hopelessness"] },
      ],
    })
  )
  assertEqual(
    "tier 1: fuzzy-matches 'Current Major Depressive Episode' heading to bare table label, no code (bare episode)",
    section.paragraphs[0].paragraph,
    "The client reports having symptoms that meet full diagnostic criteria for: Current Major Depressive Episode, including sadness and hopelessness."
  )
}

{
  const section = buildSageSrCoreSection(
    baseParsed({
      highConcernDiagnoses: [{ label: "Agoraphobia with Panic Disorder", icd10Code: "F40.01" }],
      endorsedSymptomsByDiagnosis: [{ diagnosis: "Agoraphobia", symptoms: ["Avoided situation"] }],
    })
  )
  assertEqual(
    "tier 1: fuzzy-matches shortened 'Agoraphobia' heading to the fuller table label",
    section.paragraphs[0].paragraph,
    "The client reports having symptoms that meet full diagnostic criteria for: Agoraphobia (F40.01), including avoided situation."
  )
}

// --- Tier 1: real Test01 case with no matching heading at all (Bipolar I Disorder —
// TeleSage only prints symptom detail under "Manic Episode", never a separate
// "Bipolar I Disorder" heading) ---

{
  const section = buildSageSrCoreSection(
    baseParsed({
      highConcernDiagnoses: [{ label: "Bipolar I Disorder", icd10Code: "F31.x" }],
      endorsedSymptomsByDiagnosis: [{ diagnosis: "Manic Episode", symptoms: ["Elevated/elated mood"] }],
    })
  )
  assertEqual(
    "tier 1: unmatched diagnosis (Bipolar I Disorder) falls back to a no-detail sentence rather than guessing",
    section.paragraphs[0].paragraph,
    "The client reports having symptoms that meet full diagnostic criteria for: Bipolar I Disorder (F31.x). Detailed symptom-level data was not available for this diagnosis."
  )
}

// --- Tier 2: Option B — collapsed sentence, no codes, no per-item detail ---

assertEqual(
  "tier 2: collapsed sentence naming diagnoses only, no codes",
  buildSageSrCoreSection(
    baseParsed({
      furtherEvaluationSymptomsByDiagnosis: [
        { diagnosis: "Persistent Depressive Disorder", symptoms: ["irrelevant to tier 2 output"] },
        { diagnosis: "Attention-Deficit Hyperactivity Disorder", symptoms: [] },
      ],
    })
  ).furtherEvaluationSentence,
  "The following areas warrant further evaluation based on the client's answers: Persistent Depressive Disorder and Attention-Deficit Hyperactivity Disorder."
)

assertEqual(
  "tier 2: nothing in this tier → null",
  buildSageSrCoreSection(baseParsed()).furtherEvaluationSentence,
  null
)

// --- Tier 3: bare list, no codes ---

assertEqual(
  "tier 3: bare list sentence",
  buildSageSrCoreSection(
    baseParsed({ absentOrMinimalDiagnoses: ["Schizophrenia", "Opioid Use Disorder"] })
  ).absentOrMinimalSentence,
  "No significant symptoms were reported for Schizophrenia and Opioid Use Disorder."
)

assertEqual(
  "tier 3: nothing in this tier → null",
  buildSageSrCoreSection(baseParsed()).absentOrMinimalSentence,
  null
)

console.log("\nAll sage-sr-core selftests passed.")
