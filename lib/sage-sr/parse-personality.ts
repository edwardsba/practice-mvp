import type { SageSrTextRow } from "./extract-pdf-text"

export interface SageSrPersonalityTraitItem {
  item: string
  response: string
  /** Whether the "Before Age 21" column was checked for this item. Detected via a
   *  private-use-area icon-font character (Unicode codepoint 63027 / U+F633) — the
   *  checkmark is a font glyph, not standard text, and displays as invisible in plain
   *  string output, but is genuinely present in the PDF's text layer and was confirmed
   *  to vary (85 of 157 real content rows carry it, not all) rather than being a fixed
   *  decorative element that's always present. */
  beforeAge21: boolean
}

export interface SageSrPersonalityParsedResult {
  /** Trait name -> concern tier ('high' | 'medium') and its items. Low-concern traits
   *  (per the Report Key's third tier) never get an item-level breakdown anywhere in
   *  this report — same pattern as Core Clinician's "Areas with Absent or Minimal
   *  Symptoms" list — so they simply don't appear here at all; a trait's absence from
   *  this result means low concern, not a parsing gap. */
  traits: Record<string, { concernTier: "high" | "medium"; items: SageSrPersonalityTraitItem[] }>
}

/** All 10 DSM-5-TR personality disorders this report screens, matching the "X Traits"
 *  heading format used before each trait's item table (e.g. "Paranoid Traits"). */
const TRAIT_NAMES = [
  "Paranoid",
  "Schizoid",
  "Antisocial",
  "Borderline",
  "Histrionic",
  "Narcissistic",
  "Dependent",
  "Schizotypal",
  "Avoidant",
  "Obsessive Compulsive",
]

const HIGH_CONCERN_MARKER = "Traits of High Concern"
const MEDIUM_CONCERN_MARKER = "Traits of Medium Concern"
const INTERPRETATION_PAGE_MARKER = "Interpreting Your Report"

const HEADER_ROW_PATTERN = /^(Response|Before|Age 21)$/
const FOOTER_ROW_PATTERN = /^(SAGE-SR (Core|Background|Personality)|© \d{4}|Report ID:)/

/** Confirmed by scanning every token across the real 10-page report (Report ID
 *  20005-1740-270): item-column text never starts at x>=400 on the trait-table pages;
 *  response-column text starts at x=411-525; the before-age-21 checkmark starts at
 *  x>=547.45. 400 and 535 sit safely in the two gaps between those observed ranges. */
const ITEM_RESPONSE_BOUNDARY_X = 400
const RESPONSE_AGE21_BOUNDARY_X = 535

const BEFORE_AGE_21_CHECKMARK_CODE = 63027

function isTraitHeading(text: string): string | null {
  if (text.includes(":")) return null
  const match = TRAIT_NAMES.find((name) => text === `${name} Traits`)
  return match ?? null
}

/**
 * Parses the Personality Report's per-trait item tables. Structurally this shares the
 * same underlying wrapping problem as the Item/Response reports (an item's question
 * text can wrap across multiple lines, e.g. "I knew that things people said were
 * really meant to threaten or insult me, even though other people were" / "unaware of
 * it.") — handled with the same rule confirmed reliable there: a row starts a new
 * item only if its item-column text is non-empty, begins with an uppercase letter, AND
 * the item currently being accumulated already looks grammatically complete.
 *
 * This report adds a third column beyond Item/Response: the "Before Age 21" checkmark,
 * confirmed (see extract-pdf-text.ts / debug notes) to render on its OWN row, offset a
 * few points below the item+response row it belongs to — never inline with the text
 * that triggered it. Handled the same way as a continuation line: checkmark presence
 * is tracked across every row contributing to the item currently pending, and only
 * finalized into the result when that item is flushed (either by the next new-item row
 * arriving, or the trait/tier boundary being reached) — so a checkmark landing on its
 * own dedicated row still correctly attaches to the item it visually sits under.
 *
 * Tier assignment (high vs. medium concern) comes from which "Traits of X Concern"
 * section a trait's heading falls under — the same section-boundary approach used for
 * Core Clinician's tiers, not from the severity dial graphics (which aren't text and
 * can't be read this way at all).
 */
export function parseSageSrPersonalityReport(rows: SageSrTextRow[]): SageSrPersonalityParsedResult {
  const traits: SageSrPersonalityParsedResult["traits"] = {}

  let currentTier: "high" | "medium" | null = null
  let currentTrait: string | null = null
  let pendingItemParts: string[] = []
  let pendingResponseParts: string[] = []
  let pendingBeforeAge21 = false

  const flush = () => {
    if (!currentTrait || !currentTier) {
      pendingItemParts = []
      pendingResponseParts = []
      pendingBeforeAge21 = false
      return
    }
    if (pendingItemParts.length === 0 || pendingResponseParts.length === 0) return
    traits[currentTrait].items.push({
      item: pendingItemParts.join(" ").replace(/\s+/g, " ").trim(),
      response: pendingResponseParts.join(" ").replace(/\s+/g, " ").trim(),
      beforeAge21: pendingBeforeAge21,
    })
    pendingItemParts = []
    pendingResponseParts = []
    pendingBeforeAge21 = false
  }

  for (const row of rows) {
    if (row.items.length === 0) continue
    const firstStr = row.items[0].str

    if (FOOTER_ROW_PATTERN.test(firstStr)) continue
    if (HEADER_ROW_PATTERN.test(firstStr)) continue

    const combinedText = row.items.map((i) => i.str).join(" ")

    if (combinedText.includes(INTERPRETATION_PAGE_MARKER)) {
      // Final page of the report — no more trait tables follow. Without this, every
      // row on this page (a long block of general-education prose) gets silently
      // swept into whichever trait was still "current" from the last table, since
      // nothing else in the document signals that the tables have ended.
      flush()
      currentTrait = null
      currentTier = null
      continue
    }
    if (combinedText.includes(HIGH_CONCERN_MARKER)) {
      flush()
      currentTier = "high"
      continue
    }
    if (combinedText.includes(MEDIUM_CONCERN_MARKER)) {
      flush()
      currentTier = "medium"
      continue
    }

    const itemPart = row.items
      .filter((i) => i.x < ITEM_RESPONSE_BOUNDARY_X)
      .map((i) => i.str)
      .join(" ")
      .trim()

    const traitHeading = itemPart ? isTraitHeading(itemPart) : null
    if (traitHeading) {
      flush()
      currentTrait = traitHeading
      if (currentTier && !traits[currentTrait]) {
        traits[currentTrait] = { concernTier: currentTier, items: [] }
      }
      continue
    }

    if (!currentTrait || !currentTier) continue // page 1 dials / page 10 interpretation / disclaimer text — not part of any trait table

    const responsePart = row.items
      .filter((i) => i.x >= ITEM_RESPONSE_BOUNDARY_X && i.x < RESPONSE_AGE21_BOUNDARY_X)
      .map((i) => i.str)
      .join(" ")
      .trim()
    const hasCheckmark = row.items.some(
      (i) => i.x >= RESPONSE_AGE21_BOUNDARY_X && i.str.length === 1 && i.str.charCodeAt(0) === BEFORE_AGE_21_CHECKMARK_CODE
    )

    if (!itemPart && !responsePart && !hasCheckmark) continue

    const lastPendingFragment = pendingItemParts[pendingItemParts.length - 1]
    const previousItemLooksComplete =
      pendingItemParts.length === 0 || (lastPendingFragment !== undefined && /[.?!)’'"]$/.test(lastPendingFragment))
    const startsNewItem = itemPart.length > 0 && /^[A-Z]/.test(itemPart) && previousItemLooksComplete

    if (startsNewItem) flush()

    if (itemPart) pendingItemParts.push(itemPart)
    if (responsePart) pendingResponseParts.push(responsePart)
    if (hasCheckmark) pendingBeforeAge21 = true
  }
  flush() // final pending item, if any

  return { traits }
}
