import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

import { normalizeSageSrText } from "./normalize-text"

/** Gap (in PDF points) between the end of one text chunk and the start of the next,
 *  above which they're treated as separate columns rather than words in one phrase.
 *  Confirmed against the real Core Clinician Report: normal word-to-word gaps within
 *  a flowing sentence are 2-3pt; the gap between two-column symptom-checklist entries
 *  is 140-220pt. 20pt leaves a wide, safe margin on both sides. */
const COLUMN_GAP_THRESHOLD = 20

/** A single reconstructed text row on a page.
 *  `text` is every cell joined with a single space — convenient for substring matching
 *  (section headers, disclaimer text) but loses column boundaries.
 *  `cells` preserves those boundaries — required for genuinely two-column content like
 *  the endorsed-symptom checklists (e.g. "Sadness" / "Physically restless" as two
 *  separate cells, not one merged string) and the diagnosis-table's label/code pairs. */
export interface SageSrTextRow {
  page: number
  y: number
  text: string
  cells: string[]
}

export interface SageSrExtractedPdf {
  pageCount: number
  /** Every text item in document reading order, normalized, empty strings dropped.
   *  Use this for metadata lookups (Client ID, Evaluation Date, footer version) —
   *  robust regardless of multi-column header layouts, since it doesn't assume any
   *  particular row/column structure. */
  flatItems: string[]
  /** Text grouped into rows by y-coordinate per page, for tables that ARE genuinely
   *  single-column (the diagnosis list, the item/response tables). Do not use this
   *  for the multi-column header area (Assessment Details / Report Key / Metrics
   *  boxes sit side-by-side at the same y-coordinates and will interleave). */
  rows: SageSrTextRow[]
}

/**
 * Extracts text from a SAGE-SR PDF buffer using pdfjs-dist's Node-compatible legacy
 * build (the standard client-facing build in this repo, used by pdf-viewer.tsx, is
 * browser/worker-only — this uses the separate legacy/build entry point instead,
 * which runs synchronously in Node without a worker).
 */
export async function extractSageSrPdfText(buffer: Buffer): Promise<SageSrExtractedPdf> {
  const data = new Uint8Array(buffer)
  const doc = await getDocument({ data }).promise

  const flatItems: string[] = []
  const rows: SageSrTextRow[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()

    const rowsByY = new Map<number, { x: number; width: number; str: string }[]>()

    for (const item of content.items) {
      if (!("str" in item)) continue // skip TextMarkedContent items, only TextItem has str
      const normalized = normalizeSageSrText(item.str)
      if (!normalized) continue

      flatItems.push(normalized)

      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      const width = "width" in item ? item.width : 0
      if (!rowsByY.has(y)) rowsByY.set(y, [])
      rowsByY.get(y)!.push({ x, width, str: normalized })
    }

    for (const [y, items] of rowsByY) {
      const sorted = [...items].sort((a, b) => a.x - b.x)

      const cells: string[] = []
      let currentCell: string[] = []
      let prevEnd: number | null = null

      for (const item of sorted) {
        const gap = prevEnd !== null ? item.x - prevEnd : 0
        if (prevEnd !== null && gap > COLUMN_GAP_THRESHOLD) {
          cells.push(currentCell.join(" ").replace(/\s+/g, " ").trim())
          currentCell = []
        }
        currentCell.push(item.str)
        prevEnd = item.x + item.width
      }
      if (currentCell.length > 0) {
        cells.push(currentCell.join(" ").replace(/\s+/g, " ").trim())
      }

      const nonEmptyCells = cells.filter(Boolean)
      const text = nonEmptyCells.join(" ").trim()
      if (text) rows.push({ page: pageNum, y, text, cells: nonEmptyCells })
    }
  }

  // Sort rows top-to-bottom within each page, matching reading order.
  rows.sort((a, b) => (a.page !== b.page ? a.page - b.page : b.y - a.y))

  return { pageCount: doc.numPages, flatItems, rows }
}
