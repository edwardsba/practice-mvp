import type { SageSrTextRow } from "./extract-pdf-text"

export interface SageSrItemResponsePair {
  item: string
  response: string
}

const HEADER_ROW_PATTERN = /^Item$/
const FOOTER_ROW_PATTERN = /^(SAGE-SR (Core|Background|Personality)|© \d{4}|Report ID:)/
const DEMOGRAPHICS_LABEL_PATTERN = /^(Client ID:|Year of Birth:|Sex at Birth:|Evaluation Date:)/

/**
 * Finds the Response column's x-position from the "Item | Response" header row that
 * repeats at the top of every page. This position varies between report types (e.g.
 * ~223 for Core Response, ~512 for Background Response — confirmed against both real
 * reports, wider column spacing on Background's report), so it's always detected fresh
 * from the actual header rather than assumed. Falls back to the Core Response value if
 * no header row is found at all (shouldn't normally happen, but a missing header
 * shouldn't silently break every row — better to use a known-good default and keep
 * going than throw the whole parse away).
 */
function findResponseColumnX(rows: SageSrTextRow[]): number {
  for (const row of rows) {
    const itemCell = row.items.find((i) => i.str === "Item")
    const responseCell = row.items.find((i) => i.str === "Response")
    if (itemCell && responseCell) return responseCell.x
  }
  return 223
}

/**
 * Parses a generic SAGE-SR Item/Response table — the shared structure behind every
 * "Response Report" (Core, Background, and, per the item bank alone, Personality too
 * though Personality is handled separately since its interpreted report already
 * carries the full item-level data — see parse-core-clinician.ts notes). This table
 * looks like a simple two-column layout but has real structural wrinkles confirmed
 * against actual report data:
 *
 * 1. When an Item's question text wraps across multiple lines, the Response value can
 *    land on ANY line of that wrapped block (not reliably the first or the last),
 *    because it's vertically centered against the full multi-line cell by TeleSage's
 *    PDF generator, and text extraction just reports whichever line that centered
 *    position happens to round to. E.g. "I believed that Thursday came right after"
 *    (with Response "Always" on THIS line) is immediately followed by a continuation
 *    line "Wednesday." carrying no response of its own — both belong to one question.
 *    The same wrapping can happen on the RESPONSE side alone too — confirmed in the
 *    Background Response Report, e.g. "Employed or" / "Self-employed" as two response
 *    lines for one item with no item text on the second line.
 *
 * 2. Multi-select checklist questions can have BOTH the item text AND a long
 *    comma-separated response wrap across multiple lines AT THE SAME TIME — e.g.
 *    "Which of these feelings or behaviors did" / "you experience before you were 12
 *    years" / "old?" each carry their own fragment of BOTH the question and the
 *    answer list. Naively flushing whenever any response text appears breaks this,
 *    since every one of those lines has non-empty response content.
 *
 * Both are handled with one rule: a row starts a NEW question only if its item-column
 * text is non-empty, begins with an uppercase letter, AND the question currently being
 * accumulated already looks grammatically complete (its last fragment ends in terminal
 * punctuation — . ? ! ) or a closing quote — or nothing is pending yet). That last
 * condition matters: an uppercase start alone isn't enough, because a genuine
 * continuation line can itself begin with a capitalized word (e.g. "Wednesday."
 * completing "...Thursday came right after") — checked directly against real data
 * after an earlier version of this rule (uppercase-start alone) incorrectly split that
 * exact case. Any row that doesn't meet the full condition is treated as a
 * continuation of the current question — its item fragment appended to the pending
 * item text, and its response fragment (if any) appended to the pending response —
 * regardless of whether that row happens to carry response content of its own.
 */
export function parseSageSrItemResponseTable(rows: SageSrTextRow[]): SageSrItemResponsePair[] {
  const responseColumnX = findResponseColumnX(rows)

  // Every report opens with a title, a disclaimer paragraph, and a demographics block
  // before the actual Item/Response table begins — none of that is tabular, and
  // trying to exclude it via content patterns proved unreliable (its wording isn't
  // fully predictable). Simpler and more robust: find the FIRST genuine header row
  // (where "Item" and "Response" both appear as separate items) and only parse rows
  // after it. Every subsequent per-page header repeat is still skipped individually
  // via HEADER_ROW_PATTERN inside the loop below.
  const firstHeaderIdx = rows.findIndex((row) => row.items.some((i) => i.str === "Item") && row.items.some((i) => i.str === "Response"))
  const tableRows = firstHeaderIdx === -1 ? rows : rows.slice(firstHeaderIdx + 1)

  const pairs: SageSrItemResponsePair[] = []
  let pendingItemParts: string[] = []
  let pendingResponseParts: string[] = []

  const flush = () => {
    if (pendingItemParts.length === 0 || pendingResponseParts.length === 0) return
    pairs.push({
      item: pendingItemParts.join(" ").replace(/\s+/g, " ").trim(),
      response: pendingResponseParts.join(" ").replace(/\s+/g, " ").trim(),
    })
    pendingItemParts = []
    pendingResponseParts = []
  }

  for (const row of tableRows) {
    if (row.items.length === 0) continue
    const firstStr = row.items[0].str

    if (HEADER_ROW_PATTERN.test(firstStr)) continue
    if (FOOTER_ROW_PATTERN.test(firstStr)) continue
    if (DEMOGRAPHICS_LABEL_PATTERN.test(firstStr)) continue

    const itemPart = row.items
      .filter((i) => i.x < responseColumnX)
      .map((i) => i.str)
      .join(" ")
      .trim()
    const responsePart = row.items
      .filter((i) => i.x >= responseColumnX)
      .map((i) => i.str)
      .join(" ")
      .trim()

    if (!itemPart && !responsePart) continue

    const lastPendingFragment = pendingItemParts[pendingItemParts.length - 1]
    // Terminal punctuation includes closing quote characters (’ ' ") — items like
    // "Please click 'sometimes'" (a direct instructed-response validity check) end in
    // a quote, not standard sentence punctuation, and were confirmed to falsely merge
    // with the following unrelated question until this was added.
    const previousQuestionLooksComplete =
      pendingItemParts.length === 0 || (lastPendingFragment !== undefined && /[.?!)’'"]$/.test(lastPendingFragment))
    const startsNewQuestion = itemPart.length > 0 && /^[A-Z]/.test(itemPart) && previousQuestionLooksComplete

    if (startsNewQuestion) {
      flush()
      pendingItemParts.push(itemPart)
      if (responsePart) pendingResponseParts.push(responsePart)
    } else {
      if (itemPart) pendingItemParts.push(itemPart)
      if (responsePart) pendingResponseParts.push(responsePart)
    }
  }
  flush() // final pending block, if any

  return pairs
}
