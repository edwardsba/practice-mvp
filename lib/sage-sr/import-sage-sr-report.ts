import { and, eq, gte, lt } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
  auditEvents,
  clients,
} from "@/db/schema"
import { db } from "@/lib/db"

import { detectSageSrReport, type SageSrReportKind } from "./detect-report"
import { extractSageSrPdfText } from "./extract-pdf-text"
import { parseSageSrBackgroundReport } from "./parse-background"
import { parseSageSrBackgroundResponseReport } from "./parse-background-response"
import { parseSageSrCoreClinicianReport, type SageSrCoreDiagnosis } from "./parse-core-clinician"
import { parseSageSrCoreResponseReport } from "./parse-core-response"
import { parseSageSrPersonalityReport } from "./parse-personality"
import { parseSageSrPersonalityResponseReport } from "./parse-personality-response"
import { resolveSageSrDiagnosisLabel, type SageSrResolvedDiagnosis } from "./resolve-diagnosis-codes"

/** A furtherEvaluationSymptomsByDiagnosis entry with its resolved ICD-10 code merged
 *  directly on, rather than kept in a separate array matched by position — a parallel
 *  array indexed by position is exactly the kind of implicit-ordering assumption that
 *  already caused a real bug once (see the endorsedSymptomsByDiagnosis Record->array
 *  fix in parse-core-clinician.ts) and there's no reason to keep that same risk here
 *  when it's just as easy to attach the code to the entry it belongs to. */
export interface SageSrFurtherEvaluationDiagnosis {
  diagnosis: string
  symptoms: string[]
  icd10Code: string | null
  requiresClinicalSpecifier: boolean
  codeNotes: string | null
}

/** An absent/minimal diagnosis label with its resolved code — same reasoning as
 *  SageSrFurtherEvaluationDiagnosis above; replaces what used to be a bare string
 *  paired with a same-index entry in a separate parallel array. */
export type SageSrAbsentMinimalDiagnosis = SageSrResolvedDiagnosis

/** The stored shape of assessmentResults.structuredScoreJson.clinician for a
 *  SAGE_SR_CORE instance — the Core Clinician Report's parsed data, with ICD-10 codes
 *  resolved and merged directly onto the entries that need them (medium-tier and
 *  absent/minimal; high-concern diagnoses already carry TeleSage's own printed code
 *  and pass through unchanged). This is the shape the results page should read. */
export interface SageSrCoreStoredClinicianData {
  alerts: string[]
  highConcernDiagnoses: SageSrCoreDiagnosis[]
  endorsedSymptomsByDiagnosis: { diagnosis: string; symptoms: string[] }[]
  furtherEvaluationSymptomsByDiagnosis: SageSrFurtherEvaluationDiagnosis[]
  absentOrMinimalDiagnoses: SageSrAbsentMinimalDiagnosis[]
  metrics: {
    reliabilityItemsCorrect: string | null
    durationMinutes: number | null
    itemsSkipped: string | null
  }
}

type SageSrModule = "core" | "background" | "personality"

const MODULE_ASSESSMENT_CODE: Record<SageSrModule, string> = {
  core: "SAGE_SR_CORE",
  background: "SAGE_SR_BACKGROUND",
  personality: "SAGE_SR_PERSONALITY",
}

/** Which module a detected report kind belongs to, and which key within that module's
 *  structuredScoreJson this particular file's parsed data should be stored under. Two
 *  files (interpreted + response) merge into ONE assessment record per module — see
 *  the "6 files -> 3 assessment records" plan from earlier design discussion. */
function moduleAndDataKeyForKind(kind: SageSrReportKind): { module: SageSrModule; dataKey: string } | null {
  switch (kind) {
    case "core_clinician":
      return { module: "core", dataKey: "clinician" }
    case "core_response":
      return { module: "core", dataKey: "response" }
    case "background":
      return { module: "background", dataKey: "interpreted" }
    case "background_response":
      return { module: "background", dataKey: "response" }
    case "personality":
      return { module: "personality", dataKey: "interpreted" }
    case "personality_response":
      return { module: "personality", dataKey: "response" }
    default:
      return null // 'unknown' | 'narrative_note' — neither gets imported as data
  }
}

/** Parses a date string as TeleSage prints it ("8/9/2026") into a real Date at
 *  midnight UTC. Not using `new Date(str)` directly since browser/Node date-string
 *  parsing behavior for ambiguous formats varies by locale/engine — this pins down
 *  exactly which format is expected (M/D/YYYY, confirmed against every real report). */
function parseEvaluationDate(printed: string): Date | null {
  const match = printed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, month, day, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

export type SageSrImportResult =
  | {
      ok: true
      module: SageSrModule
      kind: SageSrReportKind
      assessmentInstanceId: string
      mergedIntoExisting: boolean
    }
  | {
      ok: false
      error: string
      code: "unknown_report_type" | "not_importable" | "version_mismatch" | "missing_evaluation_date" | "missing_client_id" | "client_not_found" | "definition_not_found"
    }

/**
 * Imports one SAGE-SR PDF: detects its type, refuses cleanly if the template version
 * doesn't match what the parsers were built against, parses it, resolves ICD-10 codes
 * for anything that doesn't carry a printed code, and writes into
 * assessment_instances / assessment_results — merging with a companion file's data
 * already on record for the same client/module/date if one exists, rather than
 * requiring both files to arrive in the same request.
 *
 * IMPORTANT — unlike every parser this function calls, this orchestration layer could
 * NOT be tested end-to-end against a live database in the environment this was built
 * in (no database connection available there). Every parser it calls was individually
 * verified against real SAGE-SR PDFs; this function itself is typechecked and written
 * to match this codebase's existing transaction/insert conventions (see
 * app/clients/[client_id]/asq/new/actions.ts for the pattern this follows) but has not
 * been run against a real database. Worth a careful first real test — a genuine
 * end-to-end import against a test client — before relying on it.
 */
export async function importSageSrReport(params: {
  buffer: Buffer
  clientId: string
  practiceId: string
  practitionerProfileId: string
  userId: string
}): Promise<SageSrImportResult> {
  const { buffer, clientId, practiceId, practitionerProfileId, userId } = params

  const detection = await detectSageSrReport(buffer)

  if (detection.kind === "unknown") {
    return { ok: false, error: "This PDF doesn't match any known SAGE-SR report type.", code: "unknown_report_type" }
  }
  if (detection.kind === "narrative_note") {
    return {
      ok: false,
      error: "The Narrative Note is reference-only and isn't imported as data — attach it to the client's file separately if needed.",
      code: "not_importable",
    }
  }
  if (detection.needsVersionReview) {
    return {
      ok: false,
      error: `This report's template version (${detection.footerVersion ?? "not found"}) doesn't match what the SAGE-SR parsers were built against. TeleSage may have updated the report layout — this needs a manual review before importing, rather than risking a silent misread.`,
      code: "version_mismatch",
    }
  }

  const routing = moduleAndDataKeyForKind(detection.kind)
  if (!routing) {
    return { ok: false, error: "Unhandled report kind.", code: "unknown_report_type" }
  }
  const { module: sageSrModule, dataKey } = routing

  if (!detection.evaluationDate) {
    return { ok: false, error: "Could not find an Evaluation Date on this report.", code: "missing_evaluation_date" }
  }
  const evaluationDate = parseEvaluationDate(detection.evaluationDate)
  if (!evaluationDate) {
    return { ok: false, error: `Evaluation Date "${detection.evaluationDate}" wasn't in the expected M/D/YYYY format.`, code: "missing_evaluation_date" }
  }

  const [client] = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(and(eq(clients.clientId, clientId), eq(clients.practiceId, practiceId)))
    .limit(1)
  if (!client) {
    return { ok: false, error: "Client not found for this practice.", code: "client_not_found" }
  }

  const [definition] = await db
    .select({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, MODULE_ASSESSMENT_CODE[sageSrModule]))
    .limit(1)
  if (!definition) {
    return { ok: false, error: `Assessment definition ${MODULE_ASSESSMENT_CODE[sageSrModule]} not found — has the SAGE-SR foundation migration been run?`, code: "definition_not_found" }
  }

  // Parse the file's content according to its detected kind, and resolve ICD-10 codes
  // for whatever doesn't already carry a printed one.
  const { rows } = await extractSageSrPdfText(buffer)
  let parsedData: unknown

  switch (detection.kind) {
    case "core_clinician": {
      const parsed = parseSageSrCoreClinicianReport(rows)
      const furtherEvaluationSymptomsByDiagnosis: SageSrFurtherEvaluationDiagnosis[] = await Promise.all(
        parsed.furtherEvaluationSymptomsByDiagnosis.map(async (entry) => {
          const resolved = await resolveSageSrDiagnosisLabel(entry.diagnosis)
          return {
            diagnosis: entry.diagnosis,
            symptoms: entry.symptoms,
            icd10Code: resolved.icd10Code,
            requiresClinicalSpecifier: resolved.requiresClinicalSpecifier,
            codeNotes: resolved.codeNotes,
          }
        })
      )
      const absentOrMinimalDiagnoses: SageSrAbsentMinimalDiagnosis[] = await Promise.all(
        parsed.absentOrMinimalDiagnoses.map((label) => resolveSageSrDiagnosisLabel(label))
      )
      const stored: SageSrCoreStoredClinicianData = {
        alerts: parsed.alerts,
        highConcernDiagnoses: parsed.highConcernDiagnoses,
        endorsedSymptomsByDiagnosis: parsed.endorsedSymptomsByDiagnosis,
        furtherEvaluationSymptomsByDiagnosis,
        absentOrMinimalDiagnoses,
        metrics: parsed.metrics,
      }
      parsedData = stored
      break
    }
    case "core_response":
      parsedData = parseSageSrCoreResponseReport(rows)
      break
    case "background":
      parsedData = parseSageSrBackgroundReport(rows)
      break
    case "background_response":
      parsedData = parseSageSrBackgroundResponseReport(rows)
      break
    case "personality": {
      const parsed = parseSageSrPersonalityReport(rows)
      const traitsWithCodes: Record<string, unknown> = {}
      for (const [traitName, traitData] of Object.entries(parsed.traits)) {
        const resolved = await resolveSageSrDiagnosisLabel(traitName)
        traitsWithCodes[traitName] = { ...traitData, ...resolved }
      }
      parsedData = { traits: traitsWithCodes }
      break
    }
    case "personality_response":
      parsedData = parseSageSrPersonalityResponseReport(rows)
      break
  }

  // Find a companion instance already on record for the same client/module/date —
  // e.g. the interpreted report was uploaded first and this is its response-report
  // pair arriving second. Matched on calendar date (not exact timestamp), since the
  // two files' Evaluation Date always matches to the day in every real report checked
  // but instance creation timestamps naturally won't.
  const dayStart = evaluationDate
  const dayEnd = new Date(evaluationDate.getTime() + 24 * 60 * 60 * 1000)

  const [existing] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentResultId: assessmentResults.assessmentResultId,
      structuredScoreJson: assessmentResults.structuredScoreJson,
    })
    .from(assessmentInstances)
    .innerJoin(assessmentResults, eq(assessmentResults.assessmentInstanceId, assessmentInstances.assessmentInstanceId))
    .where(
      and(
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentInstances.assessmentDefinitionId, definition.assessmentDefinitionId),
        gte(assessmentResults.assessmentDate, dayStart),
        lt(assessmentResults.assessmentDate, dayEnd)
      )
    )
    .limit(1)

  if (existing) {
    const mergedJson = {
      ...(existing.structuredScoreJson as Record<string, unknown> | null),
      [dataKey]: parsedData,
      footerVersion: detection.footerVersion,
    }
    await db
      .update(assessmentResults)
      .set({ structuredScoreJson: mergedJson })
      .where(eq(assessmentResults.assessmentResultId, existing.assessmentResultId))

    await db.insert(auditEvents).values({
      practiceId,
      userId,
      clientId,
      eventType: "sage_sr.report_merged",
      entityType: "assessment_instance",
      entityId: existing.assessmentInstanceId,
    })

    return { ok: true, module: sageSrModule, kind: detection.kind, assessmentInstanceId: existing.assessmentInstanceId, mergedIntoExisting: true }
  }

  const result = await db.transaction(async (tx) => {
    const [instance] = await tx
      .insert(assessmentInstances)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        clientId,
        practiceId,
        practitionerProfileId,
        status: "submitted",
        submittedAt: evaluationDate,
      })
      .returning({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })

    await tx.insert(assessmentResults).values({
      assessmentInstanceId: instance.assessmentInstanceId,
      clientId,
      practiceId,
      structuredScoreJson: { [dataKey]: parsedData, footerVersion: detection.footerVersion },
      assessmentDate: evaluationDate,
      status: "scored",
    })

    await tx.insert(auditEvents).values({
      practiceId,
      userId,
      clientId,
      eventType: "sage_sr.report_imported",
      entityType: "assessment_instance",
      entityId: instance.assessmentInstanceId,
    })

    return instance
  })

  return { ok: true, module: sageSrModule, kind: detection.kind, assessmentInstanceId: result.assessmentInstanceId, mergedIntoExisting: false }
}
