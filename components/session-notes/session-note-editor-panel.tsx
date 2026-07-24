"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { startTransition, useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  finaliseSessionNote,
  finaliseSessionNoteAndDownload,
  generateSessionNotePdfPreview,
  updateSessionNoteNotes,
  type FinaliseSessionNoteAndDownloadState,
  type FinaliseSessionNoteState,
  type GenerateSessionNotePdfPreviewState,
} from "@/app/session-notes/actions"
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal"
import { SessionNotesEditor } from "@/components/session-notes/session-notes-editor"
import { Button } from "@/components/ui/button"

const initialFinaliseState: FinaliseSessionNoteState = {}
const initialFinaliseAndDownloadState: FinaliseSessionNoteAndDownloadState = {}
const initialPreviewState: GenerateSessionNotePdfPreviewState = {}

export function SessionNoteEditorPanel({
  sessionNoteId,
  initialNotes,
  isFinalised,
  cancelHref,
  rightColumn,
  deleteSection,
}: {
  sessionNoteId: string
  initialNotes: string
  isFinalised: boolean
  cancelHref: string
  rightColumn: ReactNode
  deleteSection: ReactNode
}) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [savingNotes, setSavingNotes] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [finaliseState, finaliseFormAction, finalisePending] = useActionState(
    finaliseSessionNote.bind(null, sessionNoteId),
    initialFinaliseState
  )
  const [
    finaliseAndDownloadState,
    finaliseAndDownloadFormAction,
    finaliseAndDownloadPending,
  ] = useActionState(
    finaliseSessionNoteAndDownload.bind(null, sessionNoteId),
    initialFinaliseAndDownloadState
  )
  const [previewState, previewFormAction, previewPending] = useActionState(
    generateSessionNotePdfPreview.bind(null, sessionNoteId),
    initialPreviewState
  )

  const showPreviewModal = Boolean(previewState.pdfBase64) && !isFinalised

  useEffect(() => {
    if (finaliseState.success) {
      router.refresh()
    }
  }, [finaliseState.success, router])

  useEffect(() => {
    if (finaliseAndDownloadState.success && finaliseAndDownloadState.pdfBase64) {
      const byteCharacters = atob(finaliseAndDownloadState.pdfBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: "application/pdf",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = finaliseAndDownloadState.filename ?? "session-note.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      router.refresh()
    }
  }, [
    finaliseAndDownloadState.success,
    finaliseAndDownloadState.pdfBase64,
    finaliseAndDownloadState.filename,
    router,
  ])

  async function handleSaveDraft() {
    setSavingNotes(true)
    setSaveError(null)
    const result = await updateSessionNoteNotes(sessionNoteId, notes)
    if (result.error) {
      setSaveError(result.error)
    } else {
      setSavedAt(new Date())
    }
    setSavingNotes(false)
  }

  async function handleReviewAndFinalise() {
    setSaveError(null)
    const result = await updateSessionNoteNotes(sessionNoteId, notes)
    if (result.error) {
      setSaveError(result.error)
      return
    }
    // useActionState dispatch must run inside a transition when called
    // outside a <form action>, so pending state updates correctly.
    startTransition(() => {
      previewFormAction()
    })
  }

  return (
    <>
      <div className="no-print grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="order-2 lg:order-1">
          <SessionNotesEditor
            notes={notes}
            onNotesChange={setNotes}
            readOnly={isFinalised}
          />
        </div>

        <div className="order-1 flex flex-col gap-6 lg:order-2">{rightColumn}</div>

        <div className="order-3 lg:order-2 lg:col-start-2">{deleteSection}</div>
      </div>

      {!isFinalised ? (
        <div className="no-print mt-6 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={savingNotes || previewPending}
            onClick={handleSaveDraft}
          >
            {savingNotes ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            type="button"
            disabled={previewPending || savingNotes}
            onClick={handleReviewAndFinalise}
          >
            {previewPending ? "Generating preview…" : "Review and Finalise"}
          </Button>
          {savedAt && !saveError ? (
            <span className="text-sm text-muted-foreground">
              Notes saved at{" "}
              {savedAt.toLocaleTimeString("en-AU", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          ) : null}
          {saveError ? (
            <span className="text-sm text-destructive">{saveError}</span>
          ) : null}
        </div>
      ) : null}

      {previewState.error ? (
        <p className="no-print mt-3 text-sm text-destructive">{previewState.error}</p>
      ) : null}
      {finaliseState.error ? (
        <p className="no-print mt-3 text-sm text-destructive">{finaliseState.error}</p>
      ) : null}
      {finaliseAndDownloadState.error ? (
        <p className="no-print mt-3 text-sm text-destructive">
          {finaliseAndDownloadState.error}
        </p>
      ) : null}

      {showPreviewModal ? (
        <DocumentPreviewModal
          title="Review session note"
          description="Review the PDF below before confirming finalisation."
          pdfBase64={previewState.pdfBase64!}
          onCancel={() => window.location.reload()}
          saveLabel="Finalise"
          savePending={finalisePending}
          saveFormAction={finaliseFormAction}
          saveAndDownloadLabel="Finalise and download"
          saveAndDownloadPending={finaliseAndDownloadPending}
          saveAndDownloadFormAction={finaliseAndDownloadFormAction}
        />
      ) : null}
    </>
  )
}
