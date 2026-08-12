import type { SageSrTextRow } from "./extract-pdf-text"

export interface SageSrBackgroundParsedResult {
  /** Section name (TeleSage's own heading text) -> raw content lines under it, kept
   *  faithful to the source rather than deeply typed into per-field key/value pairs.
   *  Most lines are naturally "Label: Value" text as TeleSage printed them (e.g. "Was
   *  physically abused: Never") — left as single strings rather than further split,
   *  consistent with how endorsed-symptom lists were kept in parse-core-clinician.ts;
   *  splitting into a stricter {label, value} shape is a reasonable follow-up once
   *  there's a concrete need for it, not assumed necessary up front. */
  sections: Record<string, string[]>
}

/** The x-position where the report's right-hand column of boxes begins. Section
 *  headers there start at x≈313-325 depending on which box (confirmed by scanning
 *  every item in the real 2-page report) — the earlier value of exactly 323 came from
 *  a rounded display check and was too tight, since "Presenting Behavioral Health
 *  Problem" actually starts at x=322.7, just under a naive `>= 323` cutoff, which
 *  misclassified every right-column header as left-column content. 300 sits
 *  comfortably below the true observed minimum (313.17) with margin on both sides.
 *  Classification is by each text chunk's START position only, so a long left-column
 *  value running visually close to the boundary doesn't risk misclassification. */
const COLUMN_BOUNDARY_X = 300

const FOOTER_ROW_PATTERN = /^(SAGE-SR (Core|Background|Personality)|© \d{4}|Report ID:)/

/**
 * Every section heading on the real Background Report, matched by prefix rather than
 * exact string. TeleSage's PDF generator garbles a couple of these headings' trailing
 * parenthetical annotations in a way that doesn't affect the meaningful prefix — e.g.
 * "Physical Impairment(s( )Past 30 Days)" instead of the evident intended "Physical
 * Impairment(s) (Past 30 Days)" — confirmed against the real extracted text. Matching
 * on "Physical Impairment" alone sidesteps that glitch entirely rather than trying to
 * reverse-engineer the garbled punctuation.
 */
const SECTION_HEADER_PREFIXES = [
  "Demographics",
  "Presenting Behavioral Health Problem",
  "Education",
  "Current Work Status",
  "Self-Injury Associated Items",
  "Willingness to Receive Treatment",
  "Personal Behavioral Health History",
  "Behavioral Health Treatment History",
  "Adverse Childhood Events",
  "Victim of Crime",
  "Legal History",
  "Family Behavioral Health History",
  "Current Housing and Social Supports",
  "Resiliency",
  "Physical Impairment",
  "Social Determinants of Health",
  "Phone and Internet Access",
]

function matchesSectionHeader(text: string): string | null {
  // Content lines are always "Label: Value" and therefore always contain a colon;
  // genuine section headers never do. Without this guard, a content line like
  // "Education: Graduate degree" gets wrongly matched against the "Education" header
  // prefix (since it DOES start with that string) and silently swallowed as a repeated
  // header rather than pushed as content — confirmed against real data, this caused
  // the entire "Education" section to come out with zero lines even though it should
  // contain "Education: Graduate degree".
  if (text.includes(":")) return null
  return SECTION_HEADER_PREFIXES.find((prefix) => text.startsWith(prefix)) ?? null
}

/**
 * The Background Report renders as a genuine two-column dashboard grid — NOT a simple
 * aligned table like the Core Clinician diagnosis table or the Item/Response reports.
 * Each column runs its own independent sequence of mini-sections (boxes) at a
 * different vertical rate than the other — e.g. the left column's "Self-Injury
 * Associated Items" box has 7 rows while the right column's "Willingness to Receive
 * Treatment" box next to it has only 1, so the two columns drift out of row-for-row
 * alignment almost immediately. Confirmed against the real 2-page report.
 *
 * Handled by splitting every row into left/right text at the known column boundary
 * (COLUMN_BOUNDARY_X), building two independent top-to-bottom line sequences (one per
 * column, across both pages), and walking each sequence separately with a state
 * machine: a line that matches a known section heading starts a new section; anything
 * else is content appended to the section currently being accumulated. The two
 * columns' resulting sections are merged into one flat result, since section names
 * don't collide between columns in the real data.
 */
export function parseSageSrBackgroundReport(rows: SageSrTextRow[]): SageSrBackgroundParsedResult {
  const leftLines: string[] = []
  const rightLines: string[] = []

  for (const row of rows) {
    if (row.items.length === 0) continue
    if (FOOTER_ROW_PATTERN.test(row.items[0].str)) continue

    const leftText = row.items
      .filter((i) => i.x < COLUMN_BOUNDARY_X)
      .map((i) => i.str)
      .join(" ")
      .trim()
    const rightText = row.items
      .filter((i) => i.x >= COLUMN_BOUNDARY_X)
      .map((i) => i.str)
      .join(" ")
      .trim()

    if (leftText) leftLines.push(leftText)
    if (rightText) rightLines.push(rightText)
  }

  const sections: Record<string, string[]> = {}

  function walkColumn(lines: string[]) {
    let currentSection: string | null = null
    for (const line of lines) {
      const matchedHeader = matchesSectionHeader(line)
      if (matchedHeader) {
        currentSection = matchedHeader
        if (!sections[currentSection]) sections[currentSection] = []
        continue
      }
      if (currentSection) sections[currentSection].push(line)
    }
  }

  walkColumn(leftLines)
  walkColumn(rightLines)

  return { sections }
}
