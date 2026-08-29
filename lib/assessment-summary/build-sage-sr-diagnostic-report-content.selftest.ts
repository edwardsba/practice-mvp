import assert from "node:assert/strict"

import { buildSageSrCoreSection } from "./sage-sr-core"
import { buildSageSrBackgroundSection } from "./sage-sr-background"
import { buildSageSrExclusionClauseSection } from "./sage-sr-exclusion-clause"
import {
  buildSageSrDiagnosticReportContent,
  type SageSrDiagnosticReportRawInput,
} from "./build-sage-sr-diagnostic-report-content"

function assertEqual(name: string, actual: unknown, expected: unknown) {
  assert.deepStrictEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

// Real Test01 evaluation dates (same fixtures used by sage-sr-introduction.selftest.ts and
// the content preview PDF), reused here so this selftest exercises realistic values rather
// than arbitrary placeholders.
const CORE_DATE = new Date("2026-08-09T00:00:00+10:00")
const BACKGROUND_DATE = new Date("2026-08-10T00:00:00+10:00")
const PERSONALITY_DATE = new Date("2026-08-11T00:00:00+10:00")
const GENERATED_AT = new Date("2026-08-28T09:00:00+10:00")

// A minimal but shape-accurate Core "clinician" fixture — field names and nesting match
// SageSrCoreStoredClinicianData exactly as import-sage-sr-report.ts writes it (ICD-10
// resolved onto furtherEvaluationSymptomsByDiagnosis and absentOrMinimalDiagnoses as
// SageSrResolvedDiagnosis objects, not bare strings — the real mismatch this loader's
// toCoreParsedResult() adapter exists to bridge).
const CORE_CLINICIAN_JSON = {
  alerts: ["Client endorsed active suicidal ideation."],
  highConcernDiagnoses: [{ label: "Current Major Depressive Episode", icd10Code: "F32.9" }],
  endorsedSymptomsByDiagnosis: [
    { diagnosis: "Current Major Depressive Episode", symptoms: ["sadness", "hopelessness"] },
  ],
  furtherEvaluationSymptomsByDiagnosis: [
    {
      diagnosis: "Generalized Anxiety Disorder",
      symptoms: ["excessive worry"],
      icd10Code: null,
      requiresClinicalSpecifier: false,
      codeNotes: null,
    },
  ],
  absentOrMinimalDiagnoses: [
    { label: "Panic Disorder", icd10Code: "F41.0", requiresClinicalSpecifier: false, codeNotes: null },
    { label: "Agoraphobia", icd10Code: null, requiresClinicalSpecifier: false, codeNotes: null },
  ],
  metrics: { reliabilityItemsCorrect: "5/5", durationMinutes: 26, itemsSkipped: "No items skipped" },
}

const BACKGROUND_SECTIONS_JSON = {
  sections: [{ section: "Presenting Behavioral Health Problem", lines: ["Was physically abused: Never"] }],
}

const PERSONALITY_RESPONSES_JSON = {
  responses: [{ item: "I often feel suspicious of others' motives.", response: "Often" }],
}

// --- Case 1: Core only (the minimum required module) --------------------------------

{
  const input: SageSrDiagnosticReportRawInput = {
    core: { assessmentDate: CORE_DATE, structuredScoreJson: { clinician: CORE_CLINICIAN_JSON } },
    background: null,
    personality: null,
    reportGeneratedAt: GENERATED_AT,
  }
  const result = buildSageSrDiagnosticReportContent(input)
  assert.equal(result.ok, true, "Core-only input should succeed")
  if (!result.ok) throw new Error("unreachable")

  assertEqual(
    "Core-only: Introduction mentions only Core",
    result.content.introduction,
    "This report synthesizes the client's SAGE-SR Core module results. " +
      "Core was completed on 9 Aug 2026. " +
      "The Core module took 26 minutes to complete. 5/5 reliability items were answered correctly. No items skipped. " +
      "This report was generated on 28 Aug 2026."
  )
  assertEqual("Core-only: exclusion clause matches the standalone generator", result.content.exclusionClause, buildSageSrExclusionClauseSection())
  assertEqual("Core-only: background omitted", result.content.background, null)
  assertEqual("Core-only: personality left null for the async wrapper to fill", result.content.personality, null)
  assertEqual(
    "Core-only: core section matches buildSageSrCoreSection called directly with the label-adapted input",
    result.content.core,
    buildSageSrCoreSection({
      alerts: CORE_CLINICIAN_JSON.alerts,
      highConcernDiagnoses: CORE_CLINICIAN_JSON.highConcernDiagnoses,
      endorsedSymptomsByDiagnosis: CORE_CLINICIAN_JSON.endorsedSymptomsByDiagnosis,
      furtherEvaluationSymptomsByDiagnosis: CORE_CLINICIAN_JSON.furtherEvaluationSymptomsByDiagnosis,
      absentOrMinimalDiagnoses: ["Panic Disorder", "Agoraphobia"],
      metrics: CORE_CLINICIAN_JSON.metrics,
    })
  )
}

// --- Case 2: Core + Background + Personality, all three present ---------------------

{
  const input: SageSrDiagnosticReportRawInput = {
    core: { assessmentDate: CORE_DATE, structuredScoreJson: { clinician: CORE_CLINICIAN_JSON } },
    background: { assessmentDate: BACKGROUND_DATE, structuredScoreJson: { interpreted: BACKGROUND_SECTIONS_JSON } },
    personality: { assessmentDate: PERSONALITY_DATE, structuredScoreJson: { response: PERSONALITY_RESPONSES_JSON } },
    reportGeneratedAt: GENERATED_AT,
  }
  const result = buildSageSrDiagnosticReportContent(input)
  assert.equal(result.ok, true, "all-three-modules input should succeed")
  if (!result.ok) throw new Error("unreachable")

  assertEqual(
    "all three: Introduction names all three modules in printed order",
    result.content.introduction,
    "This report synthesizes the client's SAGE-SR Core, Background, and Personality module results. " +
      "Core was completed on 9 Aug 2026, Background was completed on 10 Aug 2026, and Personality was completed on 11 Aug 2026. " +
      "The Core module took 26 minutes to complete. 5/5 reliability items were answered correctly. No items skipped. " +
      "This report was generated on 28 Aug 2026."
  )
  assertEqual(
    "all three: background section matches buildSageSrBackgroundSection called directly",
    result.content.background,
    buildSageSrBackgroundSection(BACKGROUND_SECTIONS_JSON.sections)
  )
  assertEqual(
    "all three: personality still left null here — filled in later by the DB-backed async wrapper, not this pure builder",
    result.content.personality,
    null
  )
}

// --- Case 3: Personality's interpreted report was imported, but its Response Report -
// --- companion never arrived — the real partial-import gap. Ben's explicit call:    -
// --- silently omit, exactly as if Personality wasn't imported at all.               -

{
  const input: SageSrDiagnosticReportRawInput = {
    core: { assessmentDate: CORE_DATE, structuredScoreJson: { clinician: CORE_CLINICIAN_JSON } },
    background: null,
    personality: {
      assessmentDate: PERSONALITY_DATE,
      // Has an "interpreted" key (trait/tier data) but no "response" key — the generator
      // needs the raw item/response pairs to score live, which aren't here.
      structuredScoreJson: { interpreted: { traits: [] } },
    },
    reportGeneratedAt: GENERATED_AT,
  }
  const result = buildSageSrDiagnosticReportContent(input)
  assert.equal(result.ok, true, "partial Personality import should still succeed for the rest of the report")
  if (!result.ok) throw new Error("unreachable")

  assertEqual(
    "partial Personality import: Introduction silently drops Personality from the synthesized-modules list",
    result.content.introduction,
    "This report synthesizes the client's SAGE-SR Core module results. " +
      "Core was completed on 9 Aug 2026. " +
      "The Core module took 26 minutes to complete. 5/5 reliability items were answered correctly. No items skipped. " +
      "This report was generated on 28 Aug 2026."
  )
  assertEqual("partial Personality import: personality content stays null, no distinct warning note", result.content.personality, null)
}

// --- Case 4: selected Core import has no Clinician Report data on file --------------

{
  const input: SageSrDiagnosticReportRawInput = {
    core: { assessmentDate: CORE_DATE, structuredScoreJson: {} },
    background: null,
    personality: null,
    reportGeneratedAt: GENERATED_AT,
  }
  const result = buildSageSrDiagnosticReportContent(input)
  assertEqual("missing Core clinician data: reports a clear ok:false error rather than throwing", result, {
    ok: false,
    error: "The selected Core import has no Clinician Report data on file.",
  })
}

console.log("\nAll load-sage-sr-diagnostic-report selftests passed.")
