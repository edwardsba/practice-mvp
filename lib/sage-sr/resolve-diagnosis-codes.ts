import { eq } from "drizzle-orm"

import { sageSrDiagnosisReference } from "@/db/schema"
import { db } from "@/lib/db"

export interface SageSrResolvedDiagnosis {
  label: string
  icd10Code: string | null
  requiresClinicalSpecifier: boolean
  codeNotes: string | null
}

/**
 * Resolves a diagnosis/trait label against the sage_sr_diagnosis_reference table
 * (seeded separately — see db/seed-sage-sr-diagnosis-reference.ts). Used for anything
 * that doesn't already carry a printed ICD-10 code straight from the source PDF:
 * Core's bare episodes and medium-tier "further evaluation" items, and all of
 * Personality's traits (TeleSage never prints a code anywhere in that report).
 *
 * Core's high-concern diagnosis table already carries its own printed code and should
 * NOT be routed through this — use the code TeleSage printed directly rather than
 * looking it up here, since the printed code is the more authoritative source when
 * it exists at all.
 *
 * Matching is by exact label first, then by substring/prefix tolerance (mirroring the
 * same "Current X" / "Past X" prefix-stripping and truncated-heading tolerance the
 * parsers themselves already use for matching against this same label set) — a label
 * that doesn't resolve at all comes back with icd10Code: null and a note explaining
 * that, rather than throwing, so a report with genuinely no clean policy for a given
 * label (unlikely given seed coverage) can't break an entire import.
 */
export async function resolveSageSrDiagnosisLabel(rawLabel: string): Promise<SageSrResolvedDiagnosis> {
  const stripped = rawLabel.replace(/^(Current|Past)\s+/i, "").trim()

  const [exact] = await db
    .select({
      diagnosisLabel: sageSrDiagnosisReference.diagnosisLabel,
      icd10Code: sageSrDiagnosisReference.icd10Code,
      requiresClinicalSpecifier: sageSrDiagnosisReference.requiresClinicalSpecifier,
      codeNotes: sageSrDiagnosisReference.codeNotes,
    })
    .from(sageSrDiagnosisReference)
    .where(eq(sageSrDiagnosisReference.diagnosisLabel, stripped))
    .limit(1)

  if (exact) {
    return {
      label: exact.diagnosisLabel,
      icd10Code: exact.icd10Code,
      requiresClinicalSpecifier: exact.requiresClinicalSpecifier,
      codeNotes: exact.codeNotes,
    }
  }

  // Personality disorder labels in the reference table are stored with the full
  // "X Personality Disorder" suffix, but the parser's trait names are bare (e.g.
  // "Paranoid", "Obsessive Compulsive") — try that combination before giving up.
  const [asPersonalityDisorder] = await db
    .select({
      diagnosisLabel: sageSrDiagnosisReference.diagnosisLabel,
      icd10Code: sageSrDiagnosisReference.icd10Code,
      requiresClinicalSpecifier: sageSrDiagnosisReference.requiresClinicalSpecifier,
      codeNotes: sageSrDiagnosisReference.codeNotes,
    })
    .from(sageSrDiagnosisReference)
    .where(eq(sageSrDiagnosisReference.diagnosisLabel, `${stripped} Personality Disorder`))
    .limit(1)

  if (asPersonalityDisorder) {
    return {
      label: asPersonalityDisorder.diagnosisLabel,
      icd10Code: asPersonalityDisorder.icd10Code,
      requiresClinicalSpecifier: asPersonalityDisorder.requiresClinicalSpecifier,
      codeNotes: asPersonalityDisorder.codeNotes,
    }
  }

  return {
    label: rawLabel,
    icd10Code: null,
    requiresClinicalSpecifier: true,
    codeNotes: `No match found in sage_sr_diagnosis_reference for "${rawLabel}" — needs a manual look, either at the reference table's coverage or this label's exact wording.`,
  }
}
