import type { SageSrTextRow } from "./extract-pdf-text"
import { parseSageSrItemResponseTable, type SageSrItemResponsePair } from "./parse-item-response-table"

export type SageSrBackgroundResponseItem = SageSrItemResponsePair

export interface SageSrBackgroundResponseParsedResult {
  responses: SageSrBackgroundResponseItem[]
}

/**
 * Parses the Background Response Report's Item/Response table using the same shared
 * logic as the Core Response Report — confirmed to work unmodified against the real
 * 3-page Background Response Report (63 items, including a response-side wrap
 * "Employed or" / "Self-employed" that the shared parser already handles correctly).
 *
 * Unlike Core, no validity-check items were found anywhere in this report — checked
 * every one of the 63 parsed items by hand against the real data, nothing resembling
 * an attention-check question. This is useful negative information for the still-open
 * question (see parse-core-response.ts) of where the other 2 of TeleSage's reported
 * "5/5 reliability items correct" actually live — ruled out here.
 */
export function parseSageSrBackgroundResponseReport(rows: SageSrTextRow[]): SageSrBackgroundResponseParsedResult {
  return { responses: parseSageSrItemResponseTable(rows) }
}
