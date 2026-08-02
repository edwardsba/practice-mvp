"use client"

import { useEffect, useRef, useState } from "react"
import type * as PdfJsLib from "pdfjs-dist"

import { cn } from "@/lib/utils"

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Served from /public so we do not depend on a CDN (blocked on some mobile
 * networks) or on bundler-specific worker asset resolution.
 * Kept in sync with the installed pdfjs-dist version via `npm run copy:pdf-worker`
 * (also run from postinstall).
 */
const PDFJS_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs"

const LAYOUT_WAIT_FRAMES = 120

/**
 * Wait until the scroll container has a real width and every canvas for the
 * known page count has mounted. A single rAF is not enough on slower mobile
 * devices — React may not have committed the canvas nodes yet, and flex
 * layout may still report clientWidth === 0.
 */
async function waitForCanvasesAndWidth(
  getWidth: () => number,
  canvasesReady: () => boolean,
  isCancelled: () => boolean
): Promise<number> {
  for (let frame = 0; frame < LAYOUT_WAIT_FRAMES; frame++) {
    if (isCancelled()) {
      throw new DOMException("PDF preview cancelled", "AbortError")
    }
    const width = getWidth()
    if (width > 0 && canvasesReady()) {
      return width
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  const width = getWidth()
  if (width > 0 && canvasesReady()) {
    return width
  }

  throw new Error("PDF preview layout was not ready in time")
}

/**
 * Renders every page of a base64-encoded PDF onto stacked canvases inside
 * a scrollable container. Used in place of embedding the PDF in an
 * <iframe>, since mobile browsers' built-in PDF viewers are unreliable
 * inside iframes (commonly only render the first page, no scroll).
 *
 * pdfjs-dist is loaded dynamically inside the effect below, not as a
 * top-level import. pdfjs-dist's own module code calls `new DOMMatrix()`
 * at load time, which doesn't exist in Node — a top-level import gets
 * evaluated during Next.js's server-side render pass even for a "use
 * client" component, which crashes the whole module before this
 * component's actual (correctly client-only) rendering logic ever runs.
 * Dynamic import here guarantees pdfjs-dist is only ever loaded in the
 * browser.
 */
export function PdfViewer({
  pdfBase64,
  title,
  className,
}: {
  pdfBase64: string
  title?: string
  className?: string
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const [numPages, setNumPages] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  )
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    const bytes = base64ToUint8Array(pdfBase64)
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    setDownloadUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [pdfBase64])

  useEffect(() => {
    let cancelled = false
    let pdfDoc: PdfJsLib.PDFDocumentProxy | null = null
    const renderTasks: ReturnType<PdfJsLib.PDFPageProxy["render"]>[] = []

    async function renderAllPages() {
      setStatus("loading")
      setNumPages(0)
      canvasRefs.current = []

      try {
        const pdfjsLib = await import("pdfjs-dist")
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC

        const data = base64ToUint8Array(pdfBase64)
        pdfDoc = await pdfjsLib.getDocument({ data }).promise
        if (cancelled || !pdfDoc) return

        // Mount canvas elements while still showing the loading state, then
        // wait until they exist and the container has a measurable width
        // before drawing (critical on mobile where one rAF is too early).
        setNumPages(pdfDoc.numPages)

        const containerWidth = await waitForCanvasesAndWidth(
          () => scrollContainerRef.current?.clientWidth ?? 0,
          () =>
            canvasRefs.current.length >= (pdfDoc?.numPages ?? 0) &&
            canvasRefs.current
              .slice(0, pdfDoc?.numPages ?? 0)
              .every((canvas) => canvas != null),
          () => cancelled
        )
        if (cancelled || !pdfDoc) return

        const dpr =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
        const targetWidth = Math.min(Math.max(containerWidth - 32, 1), 768)

        for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
          if (cancelled) break
          const canvas = canvasRefs.current[pageNumber - 1]
          if (!canvas) {
            throw new Error(`PDF page canvas ${pageNumber} was not mounted`)
          }

          const page = await pdfDoc.getPage(pageNumber)
          const unscaledViewport = page.getViewport({ scale: 1 })
          const scale = targetWidth / unscaledViewport.width
          const viewport = page.getViewport({ scale: scale * dpr })

          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${viewport.width / dpr}px`
          canvas.style.height = `${viewport.height / dpr}px`

          const context = canvas.getContext("2d")
          if (!context) {
            throw new Error("Could not get a 2D canvas context for PDF preview")
          }

          const renderTask = page.render({
            canvasContext: context,
            viewport,
            // pdfjs v6: canvas must be null when supplying canvasContext.
            canvas: null,
          })
          renderTasks.push(renderTask)
          await renderTask.promise
        }

        if (!cancelled) setStatus("ready")
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return
        }
        console.error("Failed to render PDF preview", error)
        if (!cancelled) setStatus("error")
      }
    }

    renderAllPages()

    return () => {
      cancelled = true
      renderTasks.forEach((task) => task.cancel())
      // pdfjs-dist v6 exposes destroy on the loading task, not the document proxy.
      void pdfDoc?.loadingTask.destroy()
    }
  }, [pdfBase64])

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "h-full min-h-0 w-full overflow-y-auto rounded-lg border bg-muted/30",
        className
      )}
    >
      {status === "error" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <p>Couldn&apos;t load the preview.</p>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={title ? `${title}.pdf` : "document.pdf"}
              className="text-primary underline"
            >
              Download the PDF instead
            </a>
          ) : null}
        </div>
      ) : (
        <div className="mx-auto flex flex-col items-center gap-4 p-4">
          {status === "loading" ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading preview…
            </div>
          ) : null}
          {Array.from({ length: numPages }).map((_, index) => (
            <canvas
              key={index}
              ref={(node) => {
                canvasRefs.current[index] = node
              }}
              className="rounded border bg-white shadow-sm"
            />
          ))}
        </div>
      )}
    </div>
  )
}
