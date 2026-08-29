import { and, eq } from "drizzle-orm"

import { assessmentInstances, assessmentResults } from "@/db/schema"
import { db } from "@/lib/db"

import { buildSageSrPersonalityReportSection } from "./sage-sr-personality"

import {
  buildSageSrDiagnosticReportContent,
  type SageSrDiagnosticReportContent,
  type SageSrDiagnosticReportLoadResult,
  type SageSrDiagnosticReportSelectedInstances,
  type StoredPersonalityJson,
} from "./build-sage-sr-diagnostic-report-content"

export {
  buildSageSrDiagnosticReportContent,
  type SageSrDiagnosticReportContent,
  type SageSrDiagnosticReportInstanceData,
  type SageSrDiagnosticReportLoadResult,
  type SageSrDiagnosticReportRawInput,
  type SageSrDiagnosticReportSelectedInstances,
} from "./build-sage-sr-diagnostic-report-content"

async function loadInstanceRow(instanceId: string, clientId: string, practiceId: string) {
  const [row] = await db
    .select({
      assessmentDate: assessmentResults.assessmentDate,
      structuredScoreJson: assessmentResults.structuredScoreJson,
    })
    .from(assessmentInstances)
    .innerJoin(
      assessmentResults,
      eq(assessmentResults.assessmentInstanceId, assessmentInstances.assessmentInstanceId)
    )
    .where(
      and(
        eq(assessmentInstances.assessmentInstanceId, instanceId),
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentInstances.practiceId, practiceId)
      )
    )
    .limit(1)
  return row ?? null
}

/**
 * Fetches the selected instances' stored data and assembles the full Diagnostic Report
 * content — the function report-generation code should call. Delegates the actual
 * shaping to buildSageSrDiagnosticReportContent (build-sage-sr-diagnostic-report-content.ts,
 * DB-free and independently selftested); this wrapper's own job is the database fetch
 * plus Personality, which is scored live against the current reference table (same
 * reasoning as buildSageSrPersonalityReportSection's own docstring) and so needs DB
 * access the pure builder deliberately doesn't have.
 *
 * Scoped by both clientId and practiceId on every fetch, per AGENTS.md's tenancy rule —
 * a selected instance ID that belongs to a different client or a different practice is
 * treated as not found, not silently loaded.
 */
export async function loadSageSrDiagnosticReportContentForClient(
  clientId: string,
  practiceId: string,
  selectedInstances: SageSrDiagnosticReportSelectedInstances,
  reportGeneratedAt: Date
): Promise<SageSrDiagnosticReportLoadResult> {
  const coreRow = await loadInstanceRow(selectedInstances.core, clientId, practiceId)
  if (!coreRow) {
    return { ok: false, error: "Selected Core import not found for this client." }
  }

  const backgroundRow = selectedInstances.background
    ? await loadInstanceRow(selectedInstances.background, clientId, practiceId)
    : null
  const personalityRow = selectedInstances.personality
    ? await loadInstanceRow(selectedInstances.personality, clientId, practiceId)
    : null

  const result = buildSageSrDiagnosticReportContent({
    core: coreRow,
    background: backgroundRow,
    personality: personalityRow,
    reportGeneratedAt,
  })
  if (!result.ok) return result

  const personalityJson = personalityRow?.structuredScoreJson as StoredPersonalityJson | null | undefined
  const personalityResponses = personalityJson?.response?.responses ?? null

  const content: SageSrDiagnosticReportContent = {
    ...result.content,
    personality: personalityResponses
      ? await buildSageSrPersonalityReportSection(personalityResponses)
      : null,
  }

  return { ok: true, content }
}
