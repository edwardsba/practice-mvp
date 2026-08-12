import type { SageSrTextRow } from "./extract-pdf-text"
import { parseSageSrItemResponseTable, type SageSrItemResponsePair } from "./parse-item-response-table"

export type SageSrCoreResponseItem = SageSrItemResponsePair

export interface SageSrCoreResponseParsedResult {
  responses: SageSrCoreResponseItem[]
  /** The validity/attention-check items found embedded in the item bank, pulled out of
   *  `responses` for visibility rather than left buried in ~150+ ordinary items — e.g.
   *  "I believed that Thursday came right after Wednesday." (should always be
   *  endorsed), "I believed that three plus nine was five." (should never be
   *  endorsed), "Please click 'sometimes'" (a direct instructed-response validity check).
   *  TeleSage's own Clinician Report only surfaces a pass/fail COUNT ("5/5 reliability
   *  items correct") — this keeps which specific items and how they were answered,
   *  which matters for judging how much weight to put on a borderline profile. See the
   *  open question noted on VALIDITY_CHECK_ITEM_SUBSTRINGS below re: only 3 of the
   *  reported 5 checks being found as explicit items in this module — confirmed absent
   *  from Background too (see parse-background-response.ts), narrowing the remaining
   *  possibility to Personality or a non-item-based scoring method. */
  validityCheckItems: SageSrCoreResponseItem[]
}

/** Exact text of the validity-check items confirmed present in the real Core Response
 *  Report (Report ID 20005-1739-560) — matched by substring rather than exact equality,
 *  since minor punctuation normalization could otherwise cause a silent miss. Note the
 *  quote character in the "click" item is a curly apostrophe (’), not straight (') —
 *  TeleSage's PDF generator uses typographic quotes there. */
const VALIDITY_CHECK_ITEM_SUBSTRINGS = [
  "Thursday came right after",
  "three plus nine was five",
  "Please click",
]

export function parseSageSrCoreResponseReport(rows: SageSrTextRow[]): SageSrCoreResponseParsedResult {
  const responses = parseSageSrItemResponseTable(rows)
  const validityCheckItems = responses.filter((r) =>
    VALIDITY_CHECK_ITEM_SUBSTRINGS.some((substr) => r.item.includes(substr))
  )
  return { responses, validityCheckItems }
}
