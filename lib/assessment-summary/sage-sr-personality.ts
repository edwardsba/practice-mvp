import { resolveSageSrDiagnosisLabel } from "@/lib/sage-sr/resolve-diagnosis-codes"
import { scoreSageSrPersonalityCriteria } from "@/lib/sage-sr/score-personality-criteria"
import type { SageSrPersonalityDisorderScore } from "@/lib/sage-sr/score-personality-criteria"
import type { SageSrPersonalityResponseItem } from "@/lib/sage-sr/parse-personality-response"

export interface SageSrPersonalityIcd10Info {
  icd10Code: string | null
  requiresClinicalSpecifier: boolean
}

export interface SageSrPersonalityDisorderParagraph {
  disorder: string
  criteriaMet: number
  totalCriteria: number
  thresholdRequired: number
  paragraph: string
}

export interface SageSrPersonalitySectionResult {
  /** One paragraph per disorder that met threshold, in the same order scoreSageSrPersonalityCriteria
   *  returned them (the reference table's own seed order — Paranoid through Obsessive-Compulsive). */
  paragraphs: SageSrPersonalityDisorderParagraph[]
  /** A single bare-list sentence naming every disorder that didn't meet threshold, or null if
   *  every disorder met threshold. Deliberately no per-item detail, matching how Core's
   *  "Areas with Absent or Minimal Symptoms" tier is handled — low-signal findings don't need
   *  the same weight as ones that actually met diagnostic threshold. */
  belowThresholdSentence: string | null
}

function stripTrailingPeriod(text: string): string {
  return text.endsWith(".") ? text.slice(0, -1) : text
}

function lowercaseFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * Pure prose-generation logic, separated from the ICD-10 lookup below so it can be
 * exercised directly against a known score set without a live database connection —
 * matching the same split already used in score-personality-criteria.ts.
 *
 * Per Ben's explicit terminology: "the client's answers satisfied criteria for X", never
 * "endorsed". Each satisfied criterion is named using our own paraphrased criterionText
 * (verified against DSM-5-TR wording during development, never the DSM-5-TR's own text
 * directly) — not an exhaustive item-by-item symptom list the way Core's diagnosis
 * paragraphs work, since the meaningful unit for personality disorders is the criterion,
 * not the individual SAGE-SR item (a criterion can be satisfied by any one of several
 * mapped items — see score-personality-criteria.ts).
 *
 * ICD-10 codes are named directly per Ben's decision. A code marked
 * requiresClinicalSpecifier is flagged inline rather than presented as a clean final code.
 *
 * Deliberately does NOT reference DSM-5-TR's exclusion criteria (schizophrenia/bipolar/
 * psychotic-disorder or medical-condition exclusion, autism-spectrum exclusion for
 * Schizotypal/OCPD, Conduct-Disorder-before-15 for Antisocial) — SAGE-SR doesn't assess
 * most of these, so this prose describes what the client's self-report answers satisfied,
 * not a completed differential diagnosis. Worth a standing caveat sentence somewhere in
 * the report shell (not generated per-disorder here) once the overall report structure is
 * built, rather than repeating it in every paragraph.
 */
export function buildSageSrPersonalitySection(
  scores: SageSrPersonalityDisorderScore[],
  icd10ByDisorder: Map<string, SageSrPersonalityIcd10Info>
): SageSrPersonalitySectionResult {
  const paragraphs: SageSrPersonalityDisorderParagraph[] = []
  const belowThreshold: string[] = []

  for (const score of scores) {
    if (!score.meetsThreshold) {
      belowThreshold.push(score.disorder)
      continue
    }

    const satisfiedCriteria = score.criteria.filter((c) => c.satisfied)
    const criteriaList = satisfiedCriteria
      .map((c) => lowercaseFirst(stripTrailingPeriod(c.criterionText)))
      .join("; ")

    const icd10 = icd10ByDisorder.get(score.disorder)
    const codeSuffix = icd10?.icd10Code
      ? icd10.requiresClinicalSpecifier
        ? ` (${icd10.icd10Code} — requires clinical determination)`
        : ` (${icd10.icd10Code})`
      : ""

    const paragraph =
      `The client's answers satisfied criteria for ${score.disorder}${codeSuffix}: ${criteriaList}. ` +
      `${score.criteriaMet} of ${score.totalCriteria} DSM-5-TR criteria were satisfied ` +
      `(threshold: \u2265${score.thresholdRequired}).`

    paragraphs.push({
      disorder: score.disorder,
      criteriaMet: score.criteriaMet,
      totalCriteria: score.totalCriteria,
      thresholdRequired: score.thresholdRequired,
      paragraph,
    })
  }

  const belowThresholdSentence =
    belowThreshold.length > 0
      ? `The following did not reach diagnostic threshold based on the client's answers: ${belowThreshold.join(", ")}.`
      : null

  return { paragraphs, belowThresholdSentence }
}

/**
 * Fetches a client's Personality criteria scores and their ICD-10 codes, then builds the
 * report section. This is the function report-generation code should call — always
 * reflects the current state of both the criteria reference table and the diagnosis
 * reference table, since scoring (like the results-page card) is computed live at render
 * time rather than stored at import — see score-personality-criteria.ts for why.
 */
export async function buildSageSrPersonalityReportSection(
  responses: SageSrPersonalityResponseItem[]
): Promise<SageSrPersonalitySectionResult> {
  const scores = await scoreSageSrPersonalityCriteria(responses)

  const icd10ByDisorder = new Map<string, SageSrPersonalityIcd10Info>()
  for (const score of scores) {
    const resolved = await resolveSageSrDiagnosisLabel(score.disorder)
    icd10ByDisorder.set(score.disorder, {
      icd10Code: resolved.icd10Code,
      requiresClinicalSpecifier: resolved.requiresClinicalSpecifier,
    })
  }

  return buildSageSrPersonalitySection(scores, icd10ByDisorder)
}
