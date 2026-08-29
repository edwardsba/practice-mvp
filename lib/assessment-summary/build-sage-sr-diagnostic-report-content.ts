import type { SageSrCoreParsedResult } from "@/lib/sage-sr/parse-core-clinician"
import type { SageSrBackgroundSection } from "@/lib/sage-sr/parse-background"
import type { SageSrPersonalityResponseItem } from "@/lib/sage-sr/parse-personality-response"
import type { SageSrCoreStoredClinicianData } from "@/lib/sage-sr/import-sage-sr-report"

import { buildSageSrIntroductionSection } from "./sage-sr-introduction"
import type { SageSrModuleType } from "./sage-sr-introduction"
import { buildSageSrExclusionClauseSection } from "./sage-sr-exclusion-clause"
import { buildSageSrBackgroundSection } from "./sage-sr-background"
import type { SageSrBackgroundReportGroups } from "./sage-sr-background"
import { buildSageSrCoreSection } from "./sage-sr-core"
import type { SageSrCoreSectionResult } from "./sage-sr-core"
import type { SageSrPersonalitySectionResult } from "./sage-sr-personality"

/** Which specific assessmentInstance was chosen per module — written by the
 *  checkbox-selection UI (mirroring report-form.tsx's existing appointment-selection
 *  pattern), not "most recent". Core is required; Background/Personality are optional.
 *  This is also the exact shape stored in sageSrDiagnosticReports.selectedInstancesJson. */
export interface SageSrDiagnosticReportSelectedInstances {
  core: string
  background: string | null
  personality: string | null
}

export interface SageSrDiagnosticReportContent {
  introduction: string | null
  exclusionClause: string
  background: SageSrBackgroundReportGroups | null
  core: SageSrCoreSectionResult
  personality: SageSrPersonalitySectionResult | null
}

export type SageSrDiagnosticReportLoadResult =
  | { ok: true; content: SageSrDiagnosticReportContent }
  | { ok: false; error: string }

/** One module's already-fetched assessmentResults row — deliberately the DB fetch's
 *  output shape, not the DB fetch itself, so the shaping logic below can be exercised
 *  directly against known data without a live database connection. Kept in this
 *  DB-free file (unlike score-personality-criteria.ts / sage-sr-personality.ts
 *  elsewhere in this feature, which mix pure and DB-backed code in one file and so
 *  have no selftest of their own — importing either one outside Next.js fails with
 *  "Cannot find module 'server-only'" via lib/db.ts) specifically so this content
 *  builder can have a real, runnable selftest. load-sage-sr-diagnostic-report.ts
 *  layers the actual database fetch on top of this file. */
export interface SageSrDiagnosticReportInstanceData {
  assessmentDate: Date
  /** assessmentResults.structuredScoreJson as stored — untyped at this boundary since
   *  it comes straight out of a jsonb column; validated below before use. */
  structuredScoreJson: unknown
}

export interface SageSrDiagnosticReportRawInput {
  core: SageSrDiagnosticReportInstanceData
  background: SageSrDiagnosticReportInstanceData | null
  personality: SageSrDiagnosticReportInstanceData | null
  reportGeneratedAt: Date
}

/**
 * Adapts Core's stored Clinician Report data back to the shape buildSageSrCoreSection
 * actually takes. Real mismatch, not a guess: import-sage-sr-report.ts resolves ICD-10
 * codes onto the medium-tier and absent/minimal entries before storing (so the results
 * page can show them), so absentOrMinimalDiagnoses is stored as SageSrResolvedDiagnosis[]
 * objects (label/icd10Code/requiresClinicalSpecifier/codeNotes) rather than the bare
 * string[] the parser originally produced and the generator still expects. Per the
 * standing design decision (tier 3 stays code-free, same reasoning as tier 2 — "adding
 * codes to a lower-confidence tier risks overstating confidence"), the codes are simply
 * dropped here, not threaded through.
 */
function toCoreParsedResult(stored: SageSrCoreStoredClinicianData): SageSrCoreParsedResult {
  return {
    alerts: stored.alerts,
    highConcernDiagnoses: stored.highConcernDiagnoses,
    endorsedSymptomsByDiagnosis: stored.endorsedSymptomsByDiagnosis,
    furtherEvaluationSymptomsByDiagnosis: stored.furtherEvaluationSymptomsByDiagnosis,
    absentOrMinimalDiagnoses: stored.absentOrMinimalDiagnoses.map((d) => d.label),
    metrics: stored.metrics,
  }
}

interface StoredCoreJson {
  clinician?: SageSrCoreStoredClinicianData
}
interface StoredBackgroundJson {
  interpreted?: { sections: SageSrBackgroundSection[] }
}
/** Exported (unlike the other two Stored*Json shapes above) because
 *  load-sage-sr-diagnostic-report.ts's DB-backed wrapper needs to independently read
 *  personality.response back out of the fetched row to decide whether to call
 *  buildSageSrPersonalityReportSection — Personality is scored live against the
 *  current reference table, so that step can't happen inside this DB-free file. */
export interface StoredPersonalityJson {
  response?: { responses: SageSrPersonalityResponseItem[] }
}

/**
 * Pure content-assembly logic — no database access, so it can be exercised directly
 * against known stored-JSON shapes (see build-sage-sr-diagnostic-report-content.selftest.ts).
 *
 * Personality's response-report gap (interpreted report on file, Response Report
 * companion missing) is handled per Ben's explicit decision: silently omit — treated
 * exactly like Personality wasn't imported at all, no distinct warning note. That
 * decision is implemented here as "not enough data to build the section", not as a
 * special case, and it also removes Personality from the Introduction's own "modules
 * synthesized" list — a module with nothing to show shouldn't be named as included.
 * The same "not enough data" handling applies to Background for the same reason,
 * though that gap hasn't come up in practice the way Personality's has.
 */
export function buildSageSrDiagnosticReportContent(
  input: SageSrDiagnosticReportRawInput
): SageSrDiagnosticReportLoadResult {
  const coreJson = input.core.structuredScoreJson as StoredCoreJson | null
  if (!coreJson?.clinician) {
    return { ok: false, error: "The selected Core import has no Clinician Report data on file." }
  }

  const backgroundJson = input.background?.structuredScoreJson as StoredBackgroundJson | null | undefined
  const backgroundSections = backgroundJson?.interpreted?.sections ?? null

  const personalityJson = input.personality?.structuredScoreJson as StoredPersonalityJson | null | undefined
  const personalityResponses = personalityJson?.response?.responses ?? null

  const imports: { module: SageSrModuleType; evaluationDate: Date }[] = [
    { module: "core", evaluationDate: input.core.assessmentDate },
  ]
  if (input.background && backgroundSections) {
    imports.push({ module: "background", evaluationDate: input.background.assessmentDate })
  }
  if (input.personality && personalityResponses) {
    imports.push({ module: "personality", evaluationDate: input.personality.assessmentDate })
  }

  const introduction = buildSageSrIntroductionSection({
    imports,
    reportGeneratedAt: input.reportGeneratedAt,
    coreMetrics: coreJson.clinician.metrics,
  })

  const content: SageSrDiagnosticReportContent = {
    introduction,
    exclusionClause: buildSageSrExclusionClauseSection(),
    core: buildSageSrCoreSection(toCoreParsedResult(coreJson.clinician)),
    background: backgroundSections ? buildSageSrBackgroundSection(backgroundSections) : null,
    personality: null, // filled in by loadSageSrDiagnosticReportContentForClient — scoring needs DB access
  }

  return { ok: true, content }
}
