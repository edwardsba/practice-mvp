"use client"

import { useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist"

import { cn } from "@/lib/utils"

// Loaded from a CDN matching the installed pdfjs-dist version, rather than
// bundled locally — sidesteps bundler-specific asset-resolution quirks
// with the worker file across Next.js's webpack/Turbopack configurations.
// No CSP is configured in this app (see next.config.ts) so this is safe.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Renders every page of a base64-encoded PDF onto stacked canvases inside
 * a scrollable container. Used in place of embedding the PDF in an
 * <iframe>, since mobile browsers' built-in PDF viewers are unreliable
 * inside iframes (commonly only render the first page, no scroll).
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

  useEffect(() => {
    let cancelled = false
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
    const renderTasks: ReturnType<pdfjsLib.PDFPageProxy["render"]>[] = []

    async function renderAllPages() {
      setStatus("loading")
      setNumPages(0)
      canvasRefs.current = []

      try {
        const data = base64ToUint8Array(pdfBase64)
        pdfDoc = await pdfjsLib.getDocument({ data }).promise
        if (cancelled || !pdfDoc) return

        setNumPages(pdfDoc.numPages)
        setStatus("ready")

        // Wait a tick so the <canvas> elements below have mounted before
        // we try to draw into them.
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (cancelled) return

        const containerWidth = scrollContainerRef.current?.clientWidth ?? 800
        const dpr =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
        const targetWidth = Math.min(containerWidth - 32, 768)

        for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
          if (cancelled) break
          const canvas = canvasRefs.current[pageNumber - 1]
          if (!canvas) continue

          const page = await pdfDoc.getPage(pageNumber)
          const unscaledViewport = page.getViewport({ scale: 1 })
          const scale = targetWidth / unscaledViewport.width
          const viewport = page.getViewport({ scale: scale * dpr })

          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${viewport.width / dpr}px`
          canvas.style.height = `${viewport.height / dpr}px`

          const context = canvas.getContext("2d")
          if (!context) continue

          const renderTask = page.render({
            canvasContext: context,
            viewport,
            canvas,
          })
          renderTasks.push(renderTask)
          await renderTask.promise
        }
      } catch (error) {
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
        "h-full w-full overflow-y-auto rounded-lg border bg-muted/30",
        className
      )}
    >
      {status === "error" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <p>Couldn&apos;t load the preview.</p>
          <a
            href={`data:application/pdf;base64,${pdfBase64}`}
            download={title ? `${title}.pdf` : "document.pdf"}
            className="text-primary underline"
          >
            Download the PDF instead
          </a>
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
