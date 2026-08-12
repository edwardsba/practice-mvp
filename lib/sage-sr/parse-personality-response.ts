import type { SageSrTextRow } from "./extract-pdf-text"
import { parseSageSrItemResponseTable, type SageSrItemResponsePair } from "./parse-item-response-table"

export type SageSrPersonalityResponseItem = SageSrItemResponsePair

export interface SageSrPersonalityResponseParsedResult {
  responses: SageSrPersonalityResponseItem[]
}

/**
 * Parses the Personality Response Report's Item/Response table using the same shared
 * logic as Core and Background Response — confirmed against the real 9-page report
 * (218 items after the no-terminal-punctuation fix below; see
 * parse-item-response-table.ts for why that fix was needed).
 *
 * Note this report is NOT the source for trait-level structured data (concern tier,
 * before-age-21 flags) — that comes from the interpreted Personality Report via
 * parse-personality.ts. This flat Item/Response list includes the "Did you experience
 * these feelings or behaviors prior to the age of 21?" follow-up as its own ordinary
 * item/response pair (unlike the interpreted report, where the same fact is conveyed
 * via a checkmark icon column instead) — both are legitimate representations of the
 * same underlying data, just in different report formats.
 */
export function parseSageSrPersonalityResponseReport(rows: SageSrTextRow[]): SageSrPersonalityResponseParsedResult {
  return { responses: parseSageSrItemResponseTable(rows) }
}
