"use client"

import Link from "next/link"
import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  finaliseSessionNote,
  generateSessionNotePdfPreview,
  getSessionNotePdfDownloadUrl,
  type FinaliseSessionNoteState,
  type GenerateSessionNotePdfPreviewState,
} from "@/app/session-notes/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { appendReturnTo } from "@/lib/navigation/back"
import { SESSION_NOTE_STATUS_CONFIG } from "@/lib/status"
import {
  formatSessionNoteDate,
  formatSessionNoteTime,
} from "@/lib/session-notes/format"

const initialFinaliseState: FinaliseSessionNoteState = {}
const initialPreviewState: GenerateSessionNotePdfPreviewState = {}

export function SessionNoteActions({
  sessionNoteId,
  status,
  pdfStoragePath,
  appointmentId,
  sessionDate,
  sessionTime,
  nextAppointment,
}: {
  sessionNoteId: string
  status: string
  pdfStoragePath: string | null
  appointmentId: string | null
  sessionDate: string
  sessionTime: string | null
  nextAppointment: { appointmentId: string; label: string } | null
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

  const sessionDateTime = (
    <>
      {formatSessionNoteDate(sessionDate)}
      {sessionTime ? `, ${formatSessionNoteTime(sessionTime)}` : ""}
    </>
  )

  return (
    <>
      <Card className="no-print mb-6">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4">
            <div>
              <dt className="mb-2 text-sm text-muted-foreground">
                Session note
              </dt>
              <dd className="flex flex-wrap items-center gap-3">
                <StatusBadge
                  status={isFinalised ? "finalised" : status}
                  statusMap={SESSION_NOTE_STATUS_CONFIG}
                />
                {isFinalised ? (
                  <>
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
                    <Button type="submit" size="sm" disabled={previewPending}>
                      {previewPending ? "Generating preview…" : "Finalise"}
                    </Button>
                  </form>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-muted-foreground">Appointment</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {appointmentId ? (
                  <Link
                    href={appendReturnTo(
                      `/appointments/${appointmentId}`,
                      `/session-notes/${sessionNoteId}`
                    )}
                    className="text-primary hover:underline"
                  >
                    {sessionDateTime}
                  </Link>
                ) : (
                  <span>{sessionDateTime}</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-muted-foreground">
                Next appointment
              </dt>
              <dd className="mt-0.5 text-sm font-medium">
                {nextAppointment ? (
                  <Link
                    href={appendReturnTo(
                      `/appointments/${nextAppointment.appointmentId}`,
                      `/session-notes/${sessionNoteId}`
                    )}
                    className="text-primary hover:underline"
                  >
                    {nextAppointment.label}
                  </Link>
                ) : (
                  <Link
                    href={`/calendar?view=month&returnTo=/session-notes/${sessionNoteId}`}
                    className="text-primary hover:underline"
                  >
                    Schedule appointment →
                  </Link>
                )}
              </dd>
            </div>
          </dl>

          {previewState.error ? (
            <p className="mt-3 text-sm text-destructive">
              {previewState.error}
            </p>
          ) : null}
          {finaliseState.error ? (
            <p className="mt-3 text-sm text-destructive">
              {finaliseState.error}
            </p>
          ) : null}
          {downloadError ? (
            <p className="mt-3 text-sm text-destructive">{downloadError}</p>
          ) : null}
        </CardContent>
      </Card>

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
