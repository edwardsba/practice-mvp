import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { normalizeSageSrText } from "./normalize-text"

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

let pdfjsLoader: Promise<PdfjsModule> | null = null

function pdfjsPackageRoot() {
  // Must not use require.resolve("pdfjs-dist/...") — Next.js/webpack rewrites
  // that call to a numeric module id (the "Received type number (65956)" error
  // on Vercel). Resolve from process.cwd() so we always get a real filesystem path.
  return join(process.cwd(), "node_modules", "pdfjs-dist")
}

function pdfjsDirUrl(relativeDir: string) {
  const href = pathToFileURL(join(pdfjsPackageRoot(), relativeDir)).href
  return href.endsWith("/") ? href : `${href}/`
}

function ensurePdfjsDomGlobals() {
  // pdfjs-dist evaluates `new DOMMatrix()` at module load (SCALE_MATRIX), even
  // for text-only getTextContent. Node has no DOMMatrix; pdfjs will polyfill it
  // from @napi-rs/canvas only when it detects a Node environment — Next.js's
  // external-module loader on Vercel does not, so the import throws
  // "Failed to load external module ... ReferenceError: DOMMatrix is not defined".
  // Stubs are enough: text extraction never uses canvas rendering.
  const g = globalThis as Record<string, unknown>
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class DOMMatrix {
      is2D = true
      isIdentity = true
      constructor(_init?: unknown) {}
      multiplySelf() {
        return this
      }
      preMultiplySelf() {
        return this
      }
      invertSelf() {
        return this
      }
      translate() {
        return this
      }
      scale() {
        return this
      }
      transformPoint(point: unknown) {
        return point
      }
    }
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = class Path2D {
      addPath() {}
    }
  }
  if (typeof g.ImageData === "undefined") {
    g.ImageData = class ImageData {
      width: number
      height: number
      data: Uint8ClampedArray
      constructor(width: number, height: number) {
        this.width = width
        this.height = height
        this.data = new Uint8ClampedArray(width * height * 4)
      }
    }
  }
}

async function loadPdfjs() {
  // Must be a dynamic import, not a top-level `import { getDocument } from ...`.
  // A static import of pdfjs-dist evaluates at Route Handler module load — before
  // POST()'s try/catch — so a crash there becomes Next.js's HTML `__next_error__`
  // page (HTTP 500) and the upload dialog can only show "Unexpected response".
  pdfjsLoader ??= (async () => {
    ensurePdfjsDomGlobals()
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")

    // On Node, pdfjs disables real Workers and runs a "fake worker" on the main
    // thread. That path does `import(GlobalWorkerOptions.workerSrc)`, which
    // defaults to "./pdf.worker.mjs" relative to process cwd — on Vercel that
    // file is not there, so getDocument() rejects with "Failed to load".
    // Resolve the real file from node_modules and import it via file:// so
    // webpack never tries to turn the worker into a missing chunk.
    const workerPath = join(
      pdfjsPackageRoot(),
      "legacy",
      "build",
      "pdf.worker.mjs"
    )
    const workerHref = pathToFileURL(workerPath).href
    pdfjs.GlobalWorkerOptions.workerSrc = workerHref
    const worker = (await import(/* webpackIgnore: true */ workerHref)) as {
      WorkerMessageHandler: unknown
    }
    ;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker

    return pdfjs
  })()
  return pdfjsLoader
}

/** Gap (in PDF points) between the end of one text chunk and the start of the next,
 *  above which they're treated as separate columns rather than words in one phrase.
 *  Confirmed against the real Core Clinician Report: normal word-to-word gaps within
 *  a flowing sentence are 2-3pt; the gap between two-column symptom-checklist entries
 *  is 140-220pt. 20pt leaves a wide, safe margin on both sides. */
const COLUMN_GAP_THRESHOLD = 20

/** A single word/phrase chunk on a row, with its exact horizontal position — used by
 *  parsers that need a fixed column boundary (e.g. the Response Reports' Item/Response
 *  table, where the Response column sits at a consistent x regardless of how long the
 *  Item text is) rather than the generic gap-based `cells` splitting below, which can
 *  misfire when a long Item value happens to leave a smaller-than-usual gap before the
 *  Response column (confirmed against real data — see parse-core-response.ts). */
export interface SageSrPositionedItem {
  x: number
  width: number
  str: string
}

/** A single reconstructed text row on a page.
 *  `text` is every cell joined with a single space — convenient for substring matching
 *  (section headers, disclaimer text) but loses column boundaries.
 *  `cells` preserves those boundaries using a generic gap threshold — required for
 *  genuinely two-column content like the endorsed-symptom checklists (e.g. "Sadness" /
 *  "Physically restless" as two separate cells) and the diagnosis-table's label/code
 *  pairs, where column widths vary but the GAP between columns is always large.
 *  `items` is the raw, unmerged, x-sorted chunk list for that same row — for tables
 *  where columns sit at a known FIXED x position instead (see SageSrPositionedItem). */
export interface SageSrTextRow {
  page: number
  y: number
  text: string
  cells: string[]
  items: SageSrPositionedItem[]
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

/** A cell produced by splitting a row's positioned items by column gap, keeping the
 *  cell's starting x position alongside its text — see splitPositionedItemsIntoCellsWithX. */
export interface SageSrPositionedCell {
  x: number
  text: string
}

/** Splits a row's x-sorted positioned items into cells wherever the horizontal gap
 *  between consecutive items exceeds COLUMN_GAP_THRESHOLD — the same logic the main
 *  extraction loop below uses to compute each row's own `cells` field, factored out so
 *  parsers needing to re-split an arbitrary item subset (e.g. one page-level column's
 *  worth of items) can reuse it rather than reimplementing the threshold check
 *  themselves. `items` must already be sorted by x (true of `row.items` per its own
 *  docstring, and of any filtered subset of it that preserves order).
 *
 *  Unlike splitPositionedItemsIntoCells (a thin wrapper around this that drops the
 *  position), this keeps each cell's starting x — needed by parsers reconstructing a
 *  genuine multi-column grid across MULTIPLE rows (e.g. a wrapped label whose
 *  continuation is a lone cell on the next row), where knowing which column a cell
 *  belongs to can't be recovered from cell index alone once a row has fewer cells than
 *  the grid has columns. See parse-core-clinician.ts's parseAbsentMinimal for the
 *  motivating real case. */
export function splitPositionedItemsIntoCellsWithX(items: SageSrPositionedItem[]): SageSrPositionedCell[] {
  const cells: SageSrPositionedCell[] = []
  let currentItems: SageSrPositionedItem[] = []
  let prevEnd: number | null = null

  const flush = () => {
    if (currentItems.length === 0) return
    const text = currentItems.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim()
    if (text) cells.push({ x: currentItems[0].x, text })
    currentItems = []
  }

  for (const item of items) {
    const gap = prevEnd !== null ? item.x - prevEnd : 0
    if (prevEnd !== null && gap > COLUMN_GAP_THRESHOLD) {
      flush()
    }
    currentItems.push(item)
    prevEnd = item.x + item.width
  }
  flush()

  return cells
}

/** String-only convenience wrapper — see splitPositionedItemsIntoCellsWithX for the
 *  position-preserving version most existing callers here don't need. */
export function splitPositionedItemsIntoCells(items: SageSrPositionedItem[]): string[] {
  return splitPositionedItemsIntoCellsWithX(items).map((c) => c.text)
}

/**
 * Extracts text from a SAGE-SR PDF buffer using pdfjs-dist's Node-compatible legacy
 * build (the standard client-facing build in this repo, used by pdf-viewer.tsx, is
 * browser/worker-only — this uses the separate legacy/build entry point instead).
 */
export async function extractSageSrPdfText(buffer: Buffer): Promise<SageSrExtractedPdf> {
  const { getDocument } = await loadPdfjs()
  const data = new Uint8Array(buffer)
  const doc = await getDocument({
    data,
    // Text extraction does not need the wasm image decoder; skipping it avoids
    // a second "Failed to load" if the wasm files aren't in the serverless bundle.
    useWasm: false,
    cMapUrl: pdfjsDirUrl("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: pdfjsDirUrl("standard_fonts"),
  }).promise

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

      const nonEmptyCells = splitPositionedItemsIntoCells(sorted)
      const text = nonEmptyCells.join(" ").trim()
      if (text) rows.push({ page: pageNum, y, text, cells: nonEmptyCells, items: sorted })
    }
  }

  // Sort rows top-to-bottom within each page, matching reading order.
  rows.sort((a, b) => (a.page !== b.page ? a.page - b.page : b.y - a.y))

  return { pageCount: doc.numPages, flatItems, rows }
}
