import { and, eq, inArray } from "drizzle-orm"

import { assessmentDefinitions, assessmentInstances, assessmentResults } from "@/db/schema"
import { db } from "@/lib/db"

const MODULE_ASSESSMENT_CODE = {
  core: "SAGE_SR_CORE",
  background: "SAGE_SR_BACKGROUND",
  personality: "SAGE_SR_PERSONALITY",
} as const

type SageSrDiagnosticReportModule = keyof typeof MODULE_ASSESSMENT_CODE

const ASSESSMENT_CODE_TO_MODULE: Record<string, SageSrDiagnosticReportModule> = {
  SAGE_SR_CORE: "core",
  SAGE_SR_BACKGROUND: "background",
  SAGE_SR_PERSONALITY: "personality",
}

/** One import round the practitioner can pick for this module in the Diagnostic Report
 *  composer — mirrors report-form.tsx's existing appointment-selection pattern
 *  (surface every real row, let the practitioner choose, never silently default to
 *  "most recent"). hasRequiredData reflects the exact same stored-JSON keys
 *  build-sage-sr-diagnostic-report-content.ts's pure builder checks before it will use
 *  this instance (clinician / interpreted.sections / response.responses) — an instance
 *  without it is still listed (so a half-imported round isn't just invisible) but the
 *  UI should disable selecting it rather than let the practitioner pick something the
 *  loader will reject. */
export interface SageSrDiagnosticReportInstanceOption {
  assessmentInstanceId: string
  evaluationDate: Date
  hasRequiredData: boolean
}

export interface SageSrDiagnosticReportInstanceOptions {
  core: SageSrDiagnosticReportInstanceOption[]
  background: SageSrDiagnosticReportInstanceOption[]
  personality: SageSrDiagnosticReportInstanceOption[]
}

function hasCoreData(json: unknown): boolean {
  const obj = json as { clinician?: unknown } | null
  return Boolean(obj?.clinician)
}

function hasBackgroundData(json: unknown): boolean {
  const obj = json as { interpreted?: { sections?: unknown } } | null
  return Boolean(obj?.interpreted?.sections)
}

function hasPersonalityData(json: unknown): boolean {
  const obj = json as { response?: { responses?: unknown } } | null
  return Boolean(obj?.response?.responses)
}

const HAS_REQUIRED_DATA: Record<SageSrDiagnosticReportModule, (json: unknown) => boolean> = {
  core: hasCoreData,
  background: hasBackgroundData,
  personality: hasPersonalityData,
}

/**
 * Lists every SAGE-SR Core/Background/Personality import round on file for a client,
 * grouped by module, for the Diagnostic Report composer's per-module instance picker.
 * Most-recent-first within each module, but this is display ordering only — the
 * composer still requires an explicit selection per module (Core mandatory,
 * Background/Personality optional) rather than defaulting to the top row, per the
 * confirmed design decision that multiple rounds are the practitioner's call, not
 * "always most recent".
 */
export async function listSageSrDiagnosticReportInstanceOptions(
  clientId: string,
  practiceId: string
): Promise<SageSrDiagnosticReportInstanceOptions> {
  const rows = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentDate: assessmentResults.assessmentDate,
      structuredScoreJson: assessmentResults.structuredScoreJson,
    })
    .from(assessmentInstances)
    .innerJoin(
      assessmentResults,
      eq(assessmentResults.assessmentInstanceId, assessmentInstances.assessmentInstanceId)
    )
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentDefinitions.assessmentDefinitionId, assessmentInstances.assessmentDefinitionId)
    )
    .where(
      and(
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentInstances.practiceId, practiceId),
        inArray(assessmentDefinitions.assessmentCode, Object.values(MODULE_ASSESSMENT_CODE))
      )
    )

  const options: SageSrDiagnosticReportInstanceOptions = { core: [], background: [], personality: [] }

  for (const row of rows) {
    const sageSrModule = ASSESSMENT_CODE_TO_MODULE[row.assessmentCode]
    if (!sageSrModule) continue // not a SAGE-SR row — shouldn't happen given the inArray filter above
    options[sageSrModule].push({
      assessmentInstanceId: row.assessmentInstanceId,
      evaluationDate: row.assessmentDate,
      hasRequiredData: HAS_REQUIRED_DATA[sageSrModule](row.structuredScoreJson),
    })
  }

  for (const sageSrModule of Object.keys(options) as SageSrDiagnosticReportModule[]) {
    options[sageSrModule].sort((a, b) => b.evaluationDate.getTime() - a.evaluationDate.getTime())
  }

  return options
}
