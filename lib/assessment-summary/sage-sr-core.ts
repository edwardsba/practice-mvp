import { diagnosisLabelsMatch } from "@/lib/sage-sr/parse-core-clinician"
import type { SageSrCoreParsedResult, SageSrDiagnosisSymptoms } from "@/lib/sage-sr/parse-core-clinician"

export interface SageSrCoreDiagnosisParagraph {
  /** Table label, exactly as TeleSage printed it in "Possible Diagnoses to Consider" —
   *  used for pairing/lookups. The generated paragraph itself uses the (sometimes more
   *  specific, e.g. "Current Major Depressive Episode") symptom-section heading text. */
  diagnosis: string
  icd10Code: string | null
  /** Symptoms exactly as printed, in TeleSage's own order — kept alongside the
   *  paragraph for anything downstream that wants the raw list rather than prose. */
  symptoms: string[]
  paragraph: string
}

export interface SageSrCoreSectionResult {
  /** Flat statement naming every Alerts item, positioned before the diagnosis
   *  paragraphs (mirrors TeleSage's own layout). Null if no alerts were raised. Per
   *  Ben's explicit instruction, this is presented exactly as plainly as any other
   *  finding — no risk-classification language, no cross-wiring with the ASQ system.
   *  Items here can and do overlap with a diagnosis paragraph's own symptom list (e.g.
   *  "Thoughts of ending life" appears in both Alerts and the Major Depressive Episode
   *  symptom list on the real Test01 report) — that's expected, not deduplicated,
   *  since Alerts and the symptom checklist are two different things TeleSage itself
   *  prints separately. */
  alertsSentence: string | null
  /** Tier 1 — "Possible Diagnoses to Consider" / "Endorsed Symptoms by Possible
   *  Diagnosis", combined. One paragraph per diagnosis, in the order TeleSage printed
   *  the top table (never clustered — e.g. the anxiety-disorder family stays as
   *  separate paragraphs, per Ben's explicit rejection of combining them). */
  paragraphs: SageSrCoreDiagnosisParagraph[]
  /** Tier 2 — "Endorsed Symptoms for Further Evaluation", collapsed into one bare-list
   *  sentence with no codes and no per-symptom detail, matching how Personality treats
   *  its own below-threshold tier. Null if nothing in this tier. */
  furtherEvaluationSentence: string | null
  /** Tier 3 — "Areas with Absent or Minimal Symptoms", same bare-list, no-code
   *  treatment as tier 2. Null if nothing in this tier. */
  absentOrMinimalSentence: string | null
}

function lowercaseFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1)
}

function joinList(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

/**
 * Builds one tier-1 paragraph. Terminology here is deliberately Core's own, older,
 * already-approved formula — NOT Personality's "the client's answers satisfied
 * criteria for X" phrasing. The two stay different for a substantive reason: Core is
 * relaying TeleSage's own already-computed "meets full diagnostic criteria"
 * determination (that's what the red/high-concern tier means in their report) — Core
 * never independently counts criteria the way Personality's scoring engine does. So
 * "reports having symptoms that meet full diagnostic criteria for" is the accurate
 * description here; "satisfied criteria for" stays specific to Personality, where this
 * app is the one doing the counting against a DSM threshold.
 *
 * Uses the symptom-section heading text (e.g. "Current Major Depressive Episode") as
 * the named diagnosis where a match exists, rather than the bare top-table label,
 * since TeleSage's Current/Past qualifier is itself clinically meaningful and was
 * printed as such. The ICD-10 code always comes from the top table — TeleSage prints
 * it there directly, never re-derived from the reference table (see
 * resolve-diagnosis-codes.ts's own docstring on why tier 1 is excluded from that
 * lookup).
 *
 * `derivedFromDiagnosisName`: a small number of Core's top-table diagnoses are never
 * separately detailed in "Endorsed Symptoms by Possible Diagnosis" at all — TeleSage
 * only prints symptom detail under a different, clinically-prior diagnosis that
 * establishes them (confirmed on the real Test01 report: "Bipolar I Disorder" has its
 * own top-table row and code but no symptom heading of its own — only "Manic Episode"
 * does, which is literally what DSM-5 requires to establish a Bipolar I diagnosis).
 * When set, the paragraph names that diagnosis instead of falling back to "detailed
 * symptom-level data was not available." Deliberately does NOT say "the symptoms
 * above/below" — table order isn't guaranteed (on the real Test01 report, Bipolar I
 * Disorder's own row actually prints BEFORE Manic Episode's, so "above" would have
 * been wrong on this exact profile) — "detailed under X in this section" holds
 * regardless of print order.
 */
function buildTier1Paragraph(
  diagnosis: { label: string; icd10Code: string | null },
  symptomEntry: SageSrDiagnosisSymptoms | undefined,
  derivedFromDiagnosisName?: string
): SageSrCoreDiagnosisParagraph {
  const name = symptomEntry?.diagnosis ?? diagnosis.label
  const codeSuffix = diagnosis.icd10Code ? ` (${diagnosis.icd10Code})` : ""
  const symptoms = symptomEntry?.symptoms ?? []

  const paragraph =
    symptoms.length > 0
      ? `The client reports having symptoms that meet full diagnostic criteria for: ${name}${codeSuffix}, including ${joinList(
          symptoms.map(lowercaseFirst)
        )}.`
      : derivedFromDiagnosisName
        ? `The client reports having symptoms that meet full diagnostic criteria for: ${name}${codeSuffix}, established by the symptoms detailed under ${derivedFromDiagnosisName} in this section.`
        : `The client reports having symptoms that meet full diagnostic criteria for: ${name}${codeSuffix}. Detailed symptom-level data was not available for this diagnosis.`

  return {
    diagnosis: diagnosis.label,
    icd10Code: diagnosis.icd10Code,
    symptoms,
    paragraph,
  }
}

/**
 * Explicit, narrow map of Core diagnoses that are structurally derived from another
 * diagnosis's symptom detail rather than having their own — see buildTier1Paragraph's
 * docstring for the confirmed real case (Bipolar I Disorder ← Manic Episode).
 * Deliberately a small explicit map rather than a general "find a related label"
 * heuristic: guessing a clinical derivation relationship for an arbitrary diagnosis
 * pair would be a much bigger and riskier claim than this one confirmed case.
 */
const DERIVED_FROM_DIAGNOSIS: Record<string, string> = {
  "Bipolar I Disorder": "Manic Episode",
}

/**
 * Builds the combined Core section of the SAGE-SR Diagnostic Report. Pure function,
 * synchronous, no DB access — unlike Personality, none of Core's three tiers need a
 * reference-table code lookup: tier 1's codes are TeleSage's own printed codes, and
 * tiers 2/3 are intentionally code-free bare lists per Ben's explicit call (matching
 * how Personality's own below-threshold tier is handled — no per-item detail, no
 * codes, since adding codes to a lower-confidence tier risks overstating confidence).
 *
 * The DSM-5-TR exclusion-clause caveat (schizophrenia/bipolar/psychotic-disorder and
 * medical-condition exclusions, etc.) is deliberately NOT generated here — same
 * standing deferral as Personality's: it belongs once in the report shell, not
 * repeated per section, and the shell doesn't exist yet.
 *
 * Metrics (reliability items correct, duration, items skipped) are deliberately not
 * read here at all — that's Introduction section material, not Core's own clinical
 * body, per Ben's explicit call.
 */
export function buildSageSrCoreSection(parsed: SageSrCoreParsedResult): SageSrCoreSectionResult {
  const alertsSentence =
    parsed.alerts.length > 0
      ? `The following items were flagged during screening: ${joinList(parsed.alerts.map(lowercaseFirst))}.`
      : null

  const paragraphs = parsed.highConcernDiagnoses.map((diagnosis) => {
    const symptomEntry = parsed.endorsedSymptomsByDiagnosis.find((entry) =>
      diagnosisLabelsMatch(entry.diagnosis, diagnosis.label)
    )

    // Only consult DERIVED_FROM_DIAGNOSIS when there's no direct match — a diagnosis
    // with its own real symptom detail always uses that, never the derived-from name.
    const derivedFromLabel = !symptomEntry ? DERIVED_FROM_DIAGNOSIS[diagnosis.label] : undefined
    const derivedFromEntry = derivedFromLabel
      ? parsed.endorsedSymptomsByDiagnosis.find((entry) => diagnosisLabelsMatch(entry.diagnosis, derivedFromLabel))
      : undefined

    return buildTier1Paragraph(diagnosis, symptomEntry, derivedFromEntry?.diagnosis)
  })

  const furtherEvaluationSentence =
    parsed.furtherEvaluationSymptomsByDiagnosis.length > 0
      ? `The following areas warrant further evaluation based on the client's answers: ${joinList(
          parsed.furtherEvaluationSymptomsByDiagnosis.map((d) => d.diagnosis)
        )}.`
      : null

  const absentOrMinimalSentence =
    parsed.absentOrMinimalDiagnoses.length > 0
      ? `No significant symptoms were reported for ${joinList(parsed.absentOrMinimalDiagnoses)}.`
      : null

  return {
    alertsSentence,
    paragraphs,
    furtherEvaluationSentence,
    absentOrMinimalSentence,
  }
}
