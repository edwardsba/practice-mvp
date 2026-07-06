"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import {
  finaliseSessionNote,
  finaliseSessionNoteAndDownload,
  generateSessionNotePdfPreview,
  type FinaliseSessionNoteAndDownloadState,
  type FinaliseSessionNoteState,
  type GenerateSessionNotePdfPreviewState,
} from "@/app/session-notes/actions"
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal"
import { AsqStatusBadge } from "@/components/session-notes/asq-status-badge"
import { PsqStatusBadge } from "@/components/session-notes/psq-status-badge"
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
const initialFinaliseAndDownloadState: FinaliseSessionNoteAndDownloadState = {}
const initialPreviewState: GenerateSessionNotePdfPreviewState = {}

export function SessionNoteActions({
  sessionNoteId,
  sessionNoteUrl,
  clientId,
  clientName,
  status,
  pdfStoragePath,
  appointmentId,
  sessionDate,
  sessionTime,
  nextAppointment,
  preSessionBatterySentAt,
  psqBatteryStatus,
  asqCompleted,
}: {
  sessionNoteId: string
  sessionNoteUrl: string
  clientId: string
  clientName: string
  status: string
  pdfStoragePath: string | null
  appointmentId: string | null
  sessionDate: string
  sessionTime: string | null
  nextAppointment: { appointmentId: string; label: string } | null
  preSessionBatterySentAt: Date | null
  psqBatteryStatus: string | null
  asqCompleted: boolean
}) {
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

  const router = useRouter()

  const isFinalised =
    status === "finalised" ||
    finaliseState.success ||
    finaliseAndDownloadState.success

  const showPreviewModal =
    Boolean(previewState.pdfBase64) && !isFinalised

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

  const sessionDateTime = (
    <>
      {formatSessionNoteDate(sessionDate)}
      {sessionTime ? `, ${formatSessionNoteTime(sessionTime)}` : ""}
    </>
  )

  return (
    <>
      <Card className="no-print mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Status</CardTitle>
          <div className="flex items-center gap-3">
            <StatusBadge
              status={isFinalised ? "finalised" : status}
              statusMap={SESSION_NOTE_STATUS_CONFIG}
            />
            {!isFinalised ? (
              <form action={previewFormAction}>
                <Button type="submit" size="sm" disabled={previewPending}>
                  {previewPending ? "Generating preview…" : "Finalise"}
                </Button>
              </form>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Client</dt>
              <dd className="mt-0.5 text-sm font-medium">
                <Link
                  href={`/clients/${clientId}`}
                  className="text-primary hover:underline"
                >
                  {clientName}
                </Link>
              </dd>
            </div>

            {isFinalised ? (
              <div>
                <dt className="mb-2 text-sm text-muted-foreground">
                  Session note
                </dt>
                <dd className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/session-notes/${sessionNoteId}/pdf`} download>
                      Download PDF
                    </a>
                  </Button>
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-sm text-muted-foreground">Appointment</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {appointmentId ? (
                  <Link
                    href={appendReturnTo(
                      `/appointments/${appointmentId}`,
                      sessionNoteUrl
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
                      sessionNoteUrl
                    )}
                    className="text-primary hover:underline"
                  >
                    {nextAppointment.label}
                  </Link>
                ) : (
                  <Link
                    href={`/calendar?view=month&clientId=${clientId}&returnTo=${encodeURIComponent(sessionNoteUrl)}`}
                    className="text-primary hover:underline"
                  >
                    Schedule appointment →
                  </Link>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-muted-foreground">Questionnaires</dt>
              <dd className="mt-0.5 flex flex-row flex-nowrap items-center gap-3">
                <span className="flex flex-row flex-nowrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">PSQ</span>
                  <PsqStatusBadge
                    sentAt={preSessionBatterySentAt}
                    psqBatteryStatus={psqBatteryStatus}
                  />
                </span>
                <span className="flex flex-row flex-nowrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">ASQ</span>
                  <AsqStatusBadge asqCompleted={asqCompleted} />
                </span>
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
          {finaliseAndDownloadState.error ? (
            <p className="mt-3 text-sm text-destructive">
              {finaliseAndDownloadState.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showPreviewModal ? (
        <DocumentPreviewModal
          title="Review session note"
          description="Review the PDF below before confirming finalisation."
          pdfBase64={previewState.pdfBase64!}
          onCancel={() => window.location.reload()}
          saveLabel="Save"
          savePending={finalisePending}
          saveFormAction={finaliseFormAction}
          saveAndDownloadLabel="Save and download"
          saveAndDownloadPending={finaliseAndDownloadPending}
          saveAndDownloadFormAction={finaliseAndDownloadFormAction}
        />
      ) : null}
    </>
  )
}
