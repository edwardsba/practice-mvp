"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  finaliseSessionNote,
  generateSessionNotePdfPreview,
  getSessionNotePdfDownloadUrl,
  type FinaliseSessionNoteState,
  type GenerateSessionNotePdfPreviewState,
} from "@/app/session-notes/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const initialFinaliseState: FinaliseSessionNoteState = {}
const initialPreviewState: GenerateSessionNotePdfPreviewState = {}

export function SessionNoteActions({
  sessionNoteId,
  status,
  pdfStoragePath,
}: {
  sessionNoteId: string
  status: string
  pdfStoragePath: string | null
}) {
  const [finaliseState, finaliseFormAction, finalisePending] = useActionState(
    finaliseSessionNote.bind(null, sessionNoteId),
    initialFinaliseState
  )

  const [previewState, previewFormAction, previewPending] = useActionState(
    generateSessionNotePdfPreview.bind(null, sessionNoteId),
    initialPreviewState
  )

  const [downloadPending, startDownloadTransition] = useTransition()
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const router = useRouter()

  const isFinalised = status === "finalised" || finaliseState.success
  const showPreviewModal =
    Boolean(previewState.pdfBase64) && !isFinalised

  useEffect(() => {
    if (finaliseState.success) {
      router.refresh()
    }
  }, [finaliseState.success, router])

  function handlePrint() {
    window.print()
  }

  function handleDownload() {
    setDownloadError(null)
    startDownloadTransition(async () => {
      const result = await getSessionNotePdfDownloadUrl(sessionNoteId)
      if (result.error || !result.url) {
        setDownloadError(result.error ?? "Download failed.")
        return
      }
      const a = document.createElement("a")
      a.href = result.url
      a.download = ""
      a.click()
    })
  }

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        {isFinalised ? (
          <>
            <Badge variant="success">Finalised</Badge>
            {pdfStoragePath ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={downloadPending}
                onClick={handleDownload}
              >
                {downloadPending ? "Preparing…" : "Download PDF"}
              </Button>
            ) : null}
          </>
        ) : (
          <form action={previewFormAction}>
            <Button type="submit" disabled={previewPending}>
              {previewPending ? "Generating preview…" : "Finalise"}
            </Button>
          </form>
        )}
        <Button type="button" variant="outline" onClick={handlePrint}>
          Print
        </Button>
        {previewState.error ? (
          <p className="w-full text-sm text-destructive">{previewState.error}</p>
        ) : null}
        {finaliseState.error ? (
          <p className="w-full text-sm text-destructive">{finaliseState.error}</p>
        ) : null}
        {downloadError ? (
          <p className="w-full text-sm text-destructive">{downloadError}</p>
        ) : null}
      </div>

      {showPreviewModal ? (
        <div className="no-print fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">Review session note</h2>
              <p className="text-sm text-muted-foreground">
                Review the PDF below before confirming finalisation.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <form action={finaliseFormAction}>
                <Button type="submit" disabled={finalisePending}>
                  {finalisePending ? "Saving…" : "Confirm & Save"}
                </Button>
              </form>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.reload()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <iframe
              src={`data:application/pdf;base64,${previewState.pdfBase64}`}
              className="h-full w-full rounded-lg border"
              title="Session note PDF preview"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
