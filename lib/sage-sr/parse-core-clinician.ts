import type { SageSrPositionedCell, SageSrTextRow } from "./extract-pdf-text"
import { splitPositionedItemsIntoCellsWithX } from "./extract-pdf-text"

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
 * True if two diagnosis-label strings (after each stripping a leading "Current "/
 * "Past " qualifier, which TeleSage adds inconsistently — e.g. "Current Major
 * Depressive Episode" in the symptom section vs. plain "Major Depressive Episode" in
 * the top diagnosis table) refer to the same diagnosis closely enough to be treated as
 * the same entry rather than two different ones. Matches on equality OR either string
 * being a prefix of the other, since TeleSage sometimes prints a shortened heading
 * (e.g. "Alcohol Use Disorder" as the heading vs. "Alcohol Use Disorder (Severe)" in
 * the top table, "Agoraphobia" vs. "Agoraphobia with Panic Disorder", or
 * "Schizoaffective Disorder" vs. "Schizoaffective Disorder, Mixed Type" — all
 * confirmed against the real Test01 Core Clinician Report).
 *
 * Exported for reuse by report-generation code that needs to pair a highConcernDiagnoses
 * table row (label + printed ICD-10 code) with its matching endorsedSymptomsByDiagnosis
 * entry (symptom detail, heading text that may carry the Current/Past prefix) — see
 * lib/assessment-summary/sage-sr-core.ts.
 */
export function diagnosisLabelsMatch(a: string, b: string): boolean {
  const normalizedA = normalizeForLabelMatch(a.replace(/^(Current|Past)\s+/i, ""))
  const normalizedB = normalizeForLabelMatch(b.replace(/^(Current|Past)\s+/i, ""))
  return normalizedA === normalizedB || normalizedA.startsWith(normalizedB) || normalizedB.startsWith(normalizedA)
}

function matchesKnownDiagnosisLabel(text: string): boolean {
  return CORE_DIAGNOSIS_LABELS.some((label) => diagnosisLabelsMatch(text, label))
}

/** Fixed x-boundary between the two symptom-checklist columns — confirmed against the
 *  real Test01 Core Clinician Report, where the left column starts at x≈55.0 and the
 *  right at x≈310.8 on every single row across every diagnosis, page after page. 180
 *  sits comfortably in the ~255pt gap between them.
 *
 *  A FIXED boundary is used instead of gap-based splitting (row.cells /
 *  splitPositionedItemsIntoCells) deliberately — gap-based splitting misfires exactly
 *  the way parse-core-response.ts's own docstring already warns it can: "a long Item
 *  value happens to leave a smaller-than-usual gap before the [fixed] column." Confirmed
 *  on this real report: "Worst 30-day period/past 12 months - Binged 20/30 days" (left
 *  column) runs to x≈295, leaving only 15.5pt before "Drinking impaired social
 *  functioning" starts at x≈310.8 — under COLUMN_GAP_THRESHOLD (20pt) — so gap-based
 *  splitting merged both columns' text into one unsplittable string on that one row. A
 *  fixed boundary doesn't care how long the left value is. */
const SYMPTOM_COLUMN_BOUNDARY_X = 180

/** Groups a diagnosis chunk's items into one column's per-row text, using each item's
 *  raw x rather than any pre-split cells. Also sidesteps a second real bug: a wrapped
 *  continuation line (e.g. "effects" wrapping from "...recovering from its") can land
 *  at a y-coordinate exactly 1pt off from the very next real row's y (sub-point
 *  rendering jitter, confirmed on this real report — e.g. y=354 vs y=353), which made
 *  extractSageSrPdfText's row grouping (which buckets by rounded y) treat them as two
 *  unrelated rows in the OLD row-major approach, landing the continuation next to an
 *  unrelated item from the other column instead of the item it actually continues.
 *  Grouping by (page, item's own row) per column here still uses each row's true y (no
 *  rounding tolerance needed) because every item is looked up against its own source
 *  row, not merged across rows by y-proximity — the fix is architectural (column
 *  isolation), not a fuzzier y match. */
function extractColumnRowTexts(chunkRows: SageSrTextRow[], side: "left" | "right"): string[] {
  const texts: string[] = []
  for (const row of chunkRows) {
    const sideItems = row.items.filter((item) =>
      side === "left" ? item.x < SYMPTOM_COLUMN_BOUNDARY_X : item.x >= SYMPTOM_COLUMN_BOUNDARY_X
    )
    if (sideItems.length === 0) continue
    const text = sideItems.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim()
    if (text) texts.push(text)
  }
  return texts
}

/** Merges a lone lowercase-leading line into the previous entry — the same wrap
 *  heuristic parseSymptomSections always used, now applied within one column's own
 *  uninterrupted top-to-bottom sequence, where a continuation is guaranteed to be the
 *  very next entry rather than possibly separated by the other column's content. */
function joinColumnIntoSymptoms(rowTexts: string[]): string[] {
  const symptoms: string[] = []
  for (const text of rowTexts) {
    const looksLikeContinuation = /^[a-z]/.test(text)
    if (looksLikeContinuation && symptoms.length > 0) {
      symptoms[symptoms.length - 1] = `${symptoms[symptoms.length - 1]} ${text}`.trim()
    } else {
      symptoms.push(text)
    }
  }
  return symptoms
}

/**
 * Parses one of the two symptom-checklist sections (high-concern "Endorsed Symptoms by
 * Possible Diagnosis" or medium-concern "Endorsed Symptoms for Further Evaluation").
 * Both share the same nominal structure — a diagnosis-name heading row, followed by
 * two-column symptom rows, repeating per diagnosis.
 *
 * Heading detection is label-based (matchesKnownDiagnosisLabel), not shape-based —
 * a diagnosis with an odd number of endorsed symptoms leaves one stranded alone on its
 * own row, which alone doesn't mean it's a new heading.
 *
 * Symptom rows themselves are handled column-aware (extractColumnRowTexts +
 * joinColumnIntoSymptoms above) rather than by flattening each row's gap-split cells in
 * row-major order — the previous row-major approach broke on two confirmed real bugs in
 * the Alcohol and Cannabis Use Disorder checklists (see extractColumnRowTexts's own
 * docstring). Order changes as a result: symptoms are now listed left-column-top-to-
 * bottom then right-column-top-to-bottom, rather than alternating per printed row —
 * a deliberate tradeoff (this checklist's left/right split is a page-space
 * convenience, not a meaningful pairing, so no clinical content is reordered in a way
 * that matters) in exchange for not losing or merging real symptom text. Nothing is
 * dropped either way. Some diagnoses (Persistent Depressive Disorder; several
 * substance-use criteria) print as a single long wrapped sentence in one column rather
 * than two-column pairs — that case is unaffected by this rewrite, since a single
 * populated column degrades to exactly the old single-column behavior.
 */
function parseSymptomSections(rows: SageSrTextRow[], startMarker: string, endMarker: string | null): SageSrDiagnosisSymptoms[] {
  const sectionRows = rowsBetween(rows, startMarker, endMarker)
  const result: SageSrDiagnosisSymptoms[] = []
  let currentEntry: SageSrDiagnosisSymptoms | null = null
  let currentChunkRows: SageSrTextRow[] = []

  const flushCurrentEntry = () => {
    if (!currentEntry) return
    const leftSymptoms = joinColumnIntoSymptoms(extractColumnRowTexts(currentChunkRows, "left"))
    const rightSymptoms = joinColumnIntoSymptoms(extractColumnRowTexts(currentChunkRows, "right"))
    currentEntry.symptoms = [...leftSymptoms, ...rightSymptoms]
  }

  for (const row of sectionRows) {
    if (row.cells.length === 0) continue
    if (FOOTER_ROW_PATTERN.test(row.cells[0])) continue

    if (row.cells.length === 1 && matchesKnownDiagnosisLabel(row.cells[0])) {
      flushCurrentEntry()
      currentEntry = { diagnosis: row.cells[0], symptoms: [] }
      currentChunkRows = []
      result.push(currentEntry)
      continue
    }

    if (!currentEntry) continue
    currentChunkRows.push(row)
  }
  flushCurrentEntry()

  return result
}

function normalizeForExactMatch(s: string): string {
  return s.replace(/^(Past|Current)\s+/i, "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim()
}

/** Column start-x repeats almost exactly row to row in this grid — confirmed against
 *  real data (the real Test01 Core Clinician Report's 3 columns land at x≈55.0,
 *  x≈225.3, x≈396.2 on every row, sub-point-consistent). 30pt is comfortably wider than
 *  any realistic same-column jitter (font/kerning variance) while staying far narrower
 *  than the real column-to-column gap (170pt+, itself well above COLUMN_GAP_THRESHOLD),
 *  so a slightly less perfectly-aligned future profile still clusters correctly. */
const SAME_COLUMN_X_TOLERANCE = 30

/** Buckets cells by x-position into columns, left-to-right. Cells are expected in
 *  top-to-bottom row order already (true of rowsBetween's output) — within each
 *  resulting column, that order is preserved, which is the whole point: a column's own
 *  cells are never interrupted by another column's content the way a flattened
 *  row-major list would interrupt them. */
function assignColumns(cells: SageSrPositionedCell[]): SageSrPositionedCell[][] {
  const columnStartXs: number[] = []
  const columns: SageSrPositionedCell[][] = []

  for (const cell of cells) {
    let columnIndex = columnStartXs.findIndex((x) => Math.abs(x - cell.x) <= SAME_COLUMN_X_TOLERANCE)
    if (columnIndex === -1) {
      columnIndex = columnStartXs.length
      columnStartXs.push(cell.x)
      columns.push([])
    }
    columns[columnIndex].push(cell)
  }

  return columnStartXs
    .map((x, i) => ({ x, cells: columns[i] }))
    .sort((a, b) => a.x - b.x)
    .map((c) => c.cells)
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
 * FORMER KNOWN LIMITATION, now fixed: running the greedy accumulator across the whole
 * ROW-major flattened cell list broke when a wrapped label's continuation cell didn't
 * land immediately next to it in reading order — the row's OTHER columns' cells sat
 * between them. Confirmed against real data before this fix: 13 of 19 labels parsed
 * cleanly, 1 trailing fragment merged the other 6 (Sedative/Hypnotic/Anxiolytic Use
 * Disorder, Inhalant Use Disorder, Schizophrenia, Other Drug Use Disorder,
 * Schizophreniform Disorder, and Stimulant Use Disorder - Amphetamine all ran together).
 * Fix: bucket cells by x-position into columns first (assignColumns above), then run
 * the same greedy accumulator independently PER COLUMN — within one column, top-to-
 * bottom order is never interrupted by another column's content, so a wrapped
 * continuation is always the very next cell in that column's own sequence. Re-verified
 * against the same real report after this change: all 19 labels parse cleanly.
 */
function parseAbsentMinimal(rows: SageSrTextRow[]): string[] {
  const sectionRows = rowsBetween(rows, SECTION_HEADERS.absentMinimalStart, null)

  const positionedCells = sectionRows
    .filter((row) => !FOOTER_ROW_PATTERN.test(row.text))
    .flatMap((row) => splitPositionedItemsIntoCellsWithX(row.items))

  const knownLabelsNormalized = new Set(CORE_DIAGNOSIS_LABELS.map(normalizeForExactMatch))
  const labels: string[] = []

  for (const column of assignColumns(positionedCells)) {
    let pending = ""
    for (const cell of column) {
      const candidate = pending ? `${pending} ${cell.text}`.trim() : cell.text
      if (knownLabelsNormalized.has(normalizeForExactMatch(candidate))) {
        labels.push(candidate)
        pending = ""
      } else {
        pending = candidate
      }
    }
    // Trailing fragment that never matched a known label — keep it rather than
    // silently dropping data, even though this means the label list may need a
    // manual look (now scoped to one column instead of the whole section).
    if (pending) labels.push(pending)
  }

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
