import type { SageSrTextRow } from "./extract-pdf-text"

export interface SageSrCoreDiagnosis {
  /** Label exactly as printed in the "Possible Diagnoses to Consider" table. */
  label: string
  /** ICD-10 code as printed directly in that table — null for bare episodes
   *  (Major Depressive Episode, Manic Episode), which TeleSage never codes there. */
  icd10Code: string | null
}

export interface SageSrDiagnosisSymptoms {
  diagnosis: string
  symptoms: string[]
}

export interface SageSrCoreParsedResult {
  alerts: string[]
  /** High-concern tier — the "Possible Diagnoses to Consider" table, with codes
   *  exactly as TeleSage printed them (no reference-table lookup needed here). */
  highConcernDiagnoses: SageSrCoreDiagnosis[]
  /** Endorsed symptoms per high-concern diagnosis, from the "Endorsed Symptoms by
   *  Possible Diagnosis" section, IN THE ORDER PRINTED — an array, not a
   *  Record<string, ...>, because Postgres's jsonb column type does not guarantee
   *  object key order survives a round trip through the database (confirmed: this was
   *  a Record originally, and after being written to and read back from
   *  structuredScoreJson, diagnoses rendered in a different order than the source PDF
   *  — e.g. Agoraphobia before Major Depressive Episode). Arrays don't have this
   *  problem — jsonb preserves array element order faithfully, which is exactly why
   *  highConcernDiagnoses above never showed this issue.
   *  `diagnosis` is the heading AS PRINTED in this section — which sometimes differs
   *  from the top-table label (e.g. "Current Major Depressive Episode" vs. "Major
   *  Depressive Episode"). Reconciling that against highConcernDiagnoses is a
   *  resolution-layer concern, not this parser's job — this keeps the raw printed
   *  heading so nothing is silently normalized away. */
  endorsedSymptomsByDiagnosis: SageSrDiagnosisSymptoms[]
  /** Medium-concern tier — "Endorsed Symptoms for Further Evaluation", same
   *  order-preserving array shape as endorsedSymptomsByDiagnosis above and for the
   *  same reason. TeleSage prints no ICD-10 code anywhere in this section. */
  furtherEvaluationSymptomsByDiagnosis: SageSrDiagnosisSymptoms[]
  /** Low-concern tier — "Areas with Absent or Minimal Symptoms". Bare labels only,
   *  no symptom detail, no code, printed by TeleSage in a multi-column layout. */
  absentOrMinimalDiagnoses: string[]
  /** Reliability/completion metrics from the "Metrics" box, if present. */
  metrics: {
    reliabilityItemsCorrect: string | null // e.g. "5/5" — kept as printed, not split into numerator/denominator, since that's a display concern
    durationMinutes: number | null
    itemsSkipped: string | null // e.g. "No items skipped" or a count — printed text varies, kept verbatim
  }
}

const SECTION_HEADERS = {
  diagnosisTableStart: "Possible Diagnoses to Consider",
  diagnosisTableEnd: "Disclaimer:",
  alertsStart: "Alerts",
  alertsEnd: "Endorsed Symptoms by Possible Diagnosis",
  endorsedSymptomsStart: "Endorsed Symptoms by Possible Diagnosis",
  furtherEvaluationStart: "Endorsed Symptoms for Further Evaluation",
  absentMinimalStart: "Areas with Absent or Minimal Symptoms",
} as const

/** Rows belonging to the demographics side-column that can appear interleaved
 *  (by row order, not by shared y — see extract-pdf-text.ts) within the diagnosis
 *  table's y-range on page 1. Excluded so they don't get parsed as diagnosis rows. */
const DEMOGRAPHICS_ROW_PATTERN = /^(Client ID:|Year of Birth:|Sex at Birth:|Evaluation Date:|\d{1,2}\/\d{1,2}\/\d{4}$)/

function rowsBetween(rows: SageSrTextRow[], startMarker: string, endMarker: string | null): SageSrTextRow[] {
  const startIdx = rows.findIndex((r) => r.text.includes(startMarker))
  if (startIdx === -1) return []
  const endIdx = endMarker ? rows.findIndex((r, i) => i > startIdx && r.text.includes(endMarker)) : rows.length
  return rows.slice(startIdx + 1, endIdx === -1 ? rows.length : endIdx)
}

function parseDiagnosisTable(rows: SageSrTextRow[]): SageSrCoreDiagnosis[] {
  const tableRows = rowsBetween(rows, SECTION_HEADERS.diagnosisTableStart, SECTION_HEADERS.diagnosisTableEnd)
  const diagnoses: SageSrCoreDiagnosis[] = []

  for (const row of tableRows) {
    if (DEMOGRAPHICS_ROW_PATTERN.test(row.text)) continue
    if (row.cells.length === 0) continue

    // Cell 0 is always the label. Cell 1, if present, is the ICD-10 code —
    // confirmed by the large x-gap between them in the real report (140+pt).
    const label = row.cells[0]
    const icd10Code = row.cells[1] ?? null
    if (!label) continue

    diagnoses.push({ label, icd10Code })
  }

  return diagnoses
}

function parseAlerts(rows: SageSrTextRow[]): string[] {
  const alertRows = rowsBetween(rows, SECTION_HEADERS.alertsStart, SECTION_HEADERS.alertsEnd)
  // Alerts print two per row in a two-column layout (e.g. "Felt depressed" / "Recent
  // panic attacks") — cells already separates them.
  return alertRows.flatMap((r) => r.cells).filter(Boolean)
}

const FOOTER_ROW_PATTERN = /^(SAGE-SR (Core|Background|Personality)|© \d{4}|Report ID:)/

/**
 * Every diagnosis label the Core module can produce, used ONLY to recognize heading
 * rows within the symptom-checklist sections below (NOT the source of truth for
 * ICD-10 codes — that's sage_sr_diagnosis_reference in the database, seeded
 * separately). This list intentionally mirrors the "core" module entries from
 * db/seed-sage-sr-diagnosis-reference.ts. If that seed data changes, update this too.
 */
const CORE_DIAGNOSIS_LABELS = [
  "Major Depressive Episode",
  "Bipolar I Disorder",
  "Manic Episode",
  "Hypomanic Episode",
  "Generalized Anxiety Disorder",
  "Panic Disorder",
  "Agoraphobia with Panic Disorder",
  "Agoraphobia",
  "Social Anxiety Disorder",
  "Obsessive-Compulsive Disorder",
  "Post-Traumatic Stress Disorder",
  "Schizoaffective Disorder, Mixed Type",
  "Alcohol Use Disorder",
  "Cannabis Use Disorder",
  "Persistent Depressive Disorder",
  "Attention-Deficit Hyperactivity Disorder",
  "Bipolar II Disorder",
  "Other Specified Bipolar Disorder",
  "Schizophrenia",
  "Schizophreniform Disorder",
  "Delusional Disorder",
  "Brief Psychotic Disorder",
  "Other Specified Psychotic Disorder",
  "Uncertain Psychotic Disorder",
  "Sedative, Hypnotic, or Anxiolytic Use Disorder",
  "Stimulant Use Disorder - Amphetamine",
  "Stimulant Use Disorder - Cocaine",
  "Opioid Use Disorder",
  "PCP Use Disorder",
  "Other Hallucinogen Use Disorder",
  "Inhalant Use Disorder",
  "Other Drug Use Disorder",
]

function normalizeForLabelMatch(s: string): string {
  return s.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * True if `text` (after stripping a leading "Current "/"Past " qualifier, which
 * TeleSage adds inconsistently — e.g. "Current Major Depressive Episode" in the
 * symptom section vs. plain "Major Depressive Episode" in the top diagnosis table)
 * matches a known diagnosis label closely enough to be treated as a section heading
 * rather than symptom content. Matches on equality OR either string being a prefix of
 * the other, since TeleSage sometimes prints a shortened heading (e.g. "Alcohol Use
 * Disorder" as the heading vs. "Alcohol Use Disorder (Severe)" in the top table, or
 * "Schizoaffective Disorder" vs. "Schizoaffective Disorder, Mixed Type").
 */
function matchesKnownDiagnosisLabel(text: string): boolean {
  const stripped = text.replace(/^(Current|Past)\s+/i, "")
  const normalized = normalizeForLabelMatch(stripped)
  return CORE_DIAGNOSIS_LABELS.some((label) => {
    const normalizedLabel = normalizeForLabelMatch(label)
    return (
      normalized === normalizedLabel ||
      normalizedLabel.startsWith(normalized) ||
      normalized.startsWith(normalizedLabel)
    )
  })
}

/**
 * Parses one of the two symptom-checklist sections (high-concern "Endorsed Symptoms by
 * Possible Diagnosis" or medium-concern "Endorsed Symptoms for Further Evaluation").
 * Both share the same nominal structure — a diagnosis-name heading row, followed by
 * two-column symptom rows, repeating per diagnosis — but real report data (checked
 * against the actual Test01 Core Clinician Report) shows two structural quirks this
 * has to handle rather than assume away:
 *
 * 1. A diagnosis with an odd number of endorsed symptoms leaves one stranded alone on
 *    its own row (single cell) — that alone doesn't mean it's a new heading. Heading
 *    detection is therefore label-based (matchesKnownDiagnosisLabel), not shape-based.
 * 2. Some diagnoses (Persistent Depressive Disorder; several substance-use criteria)
 *    print as a single long wrapped sentence across multiple rows instead of two-column
 *    pairs. A row that's a single cell, doesn't match a known label, and doesn't look
 *    like the start of a new sentence (starts lowercase) is treated as a continuation
 *    of the immediately preceding symptom entry rather than a new one — this recovers
 *    the common case (mid-word/mid-phrase wraps) even though a genuinely new sentence
 *    starting mid-list (rare in the data checked) would still land as a separate array
 *    entry rather than being merged. Content is never dropped either way — worth
 *    spot-checking against a few more real client profiles as they come in, since this
 *    is inferring structure TeleSage's PDF doesn't mark explicitly.
 */
function parseSymptomSections(rows: SageSrTextRow[], startMarker: string, endMarker: string | null): SageSrDiagnosisSymptoms[] {
  const sectionRows = rowsBetween(rows, startMarker, endMarker)
  const result: SageSrDiagnosisSymptoms[] = []
  let currentEntry: SageSrDiagnosisSymptoms | null = null

  for (const row of sectionRows) {
    if (row.cells.length === 0) continue
    if (FOOTER_ROW_PATTERN.test(row.cells[0])) continue

    if (row.cells.length === 1 && matchesKnownDiagnosisLabel(row.cells[0])) {
      currentEntry = { diagnosis: row.cells[0], symptoms: [] }
      result.push(currentEntry)
      continue
    }

    if (!currentEntry) continue

    if (row.cells.length === 1) {
      const cell = row.cells[0]
      const looksLikeContinuation = /^[a-z]/.test(cell)
      const list = currentEntry.symptoms
      if (looksLikeContinuation && list.length > 0) {
        list[list.length - 1] = `${list[list.length - 1]} ${cell}`.trim()
      } else {
        list.push(cell)
      }
      continue
    }

    currentEntry.symptoms.push(...row.cells.filter(Boolean))
  }

  return result
}

function normalizeForExactMatch(s: string): string {
  return s.replace(/^(Past|Current)\s+/i, "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * This section prints as a 2-3 column grid of bare labels, not a table with defined
 * cell boundaries per label — confirmed against real data, longer labels wrap onto a
 * second row, with the wrapped remainder landing in what looks like its own grid cell
 * (e.g. "Sedative, Hypnotic, or Anxiolytic Use" then "Disorder" on the next row).
 *
 * A shape-based heuristic (short bare word = wrap continuation) was tried first and
 * failed on real data — "Schizophrenia" is itself a short, complete, valid label, not
 * a fragment, so shape alone can't disambiguate. This instead greedily accumulates
 * cells and checks the accumulated text against CORE_DIAGNOSIS_LABELS after each one;
 * once it matches a known label, that's committed as a complete entry and accumulation
 * resets. This correctly handles both single-cell labels and multi-cell wrapped ones,
 * since it's checking against ground truth rather than guessing from formatting.
 *
 * KNOWN LIMITATION (see prompt header): when a wrapped label's continuation cell
 * doesn't land immediately next to it in reading order (true 3-column grid wrapping,
 * not the simpler 2-column checklists elsewhere), accumulation can run past it and
 * merge several labels into one trailing fragment. Confirmed against real data — 13 of
 * 14 labels parse cleanly, 1 trailing fragment merges 6. Flagged, not silently hidden;
 * a proper fix needs column-aware grid reconstruction, which felt disproportionate to
 * this section's clinical value (bare "nothing notable" labels, no codes, no detail).
 */
function parseAbsentMinimal(rows: SageSrTextRow[]): string[] {
  const sectionRows = rowsBetween(rows, SECTION_HEADERS.absentMinimalStart, null)
  const cells = sectionRows
    .flatMap((r) => r.cells)
    .filter(Boolean)
    .filter((cell) => !FOOTER_ROW_PATTERN.test(cell))

  const knownLabelsNormalized = new Set(CORE_DIAGNOSIS_LABELS.map(normalizeForExactMatch))
  const labels: string[] = []
  let pending = ""

  for (const cell of cells) {
    const candidate = pending ? `${pending} ${cell}`.trim() : cell
    if (knownLabelsNormalized.has(normalizeForExactMatch(candidate))) {
      labels.push(candidate)
      pending = ""
    } else {
      pending = candidate
    }
  }
  // Trailing fragment that never matched a known label — keep it rather than silently
  // dropping data, even though this means the label list may need a manual look.
  if (pending) labels.push(pending)

  return labels
}

function parseMetrics(rows: SageSrTextRow[]): SageSrCoreParsedResult["metrics"] {
  const allText = rows.map((r) => r.text).join(" | ")

  const reliabilityMatch = allText.match(/(\d+\/\d+) reliability items correct/)
  const durationMatch = allText.match(/Duration:\s*(\d+)\s*min/)
  const skippedMatch = allText.match(/(No items skipped|\d+ items? skipped)/)

  return {
    reliabilityItemsCorrect: reliabilityMatch?.[1] ?? null,
    durationMinutes: durationMatch ? Number(durationMatch[1]) : null,
    itemsSkipped: skippedMatch?.[1] ?? null,
  }
}

export function parseSageSrCoreClinicianReport(rows: SageSrTextRow[]): SageSrCoreParsedResult {
  return {
    alerts: parseAlerts(rows),
    highConcernDiagnoses: parseDiagnosisTable(rows),
    endorsedSymptomsByDiagnosis: parseSymptomSections(
      rows,
      SECTION_HEADERS.endorsedSymptomsStart,
      SECTION_HEADERS.furtherEvaluationStart
    ),
    furtherEvaluationSymptomsByDiagnosis: parseSymptomSections(
      rows,
      SECTION_HEADERS.furtherEvaluationStart,
      SECTION_HEADERS.absentMinimalStart
    ),
    absentOrMinimalDiagnoses: parseAbsentMinimal(rows),
    metrics: parseMetrics(rows),
  }
}
