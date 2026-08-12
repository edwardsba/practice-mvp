import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

import { normalizeSageSrText } from "./normalize-text"

/** A single reconstructed text row on a page, with its items sorted left-to-right. */
export interface SageSrTextRow {
  page: number
  y: number
  text: string
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

    const rowsByY = new Map<number, { x: number; str: string }[]>()

    for (const item of content.items) {
      if (!("str" in item)) continue // skip TextMarkedContent items, only TextItem has str
      const normalized = normalizeSageSrText(item.str)
      if (!normalized) continue

      flatItems.push(normalized)

      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      if (!rowsByY.has(y)) rowsByY.set(y, [])
      rowsByY.get(y)!.push({ x, str: normalized })
    }

    for (const [y, items] of rowsByY) {
      const text = items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
      if (text) rows.push({ page: pageNum, y, text })
    }
  }

  // Sort rows top-to-bottom within each page, matching reading order.
  rows.sort((a, b) => (a.page !== b.page ? a.page - b.page : b.y - a.y))

  return { pageCount: doc.numPages, flatItems, rows }
}
