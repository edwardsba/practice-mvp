"use client"

import { PdfViewer } from "@/components/documents/pdf-viewer"

function HiddenFields({ fields }: { fields?: Record<string, string> }) {
  if (!fields) return null
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  )
}

export function DocumentPreviewModal({
  title,
  description,
  pdfBase64,
  onCancel,
  cancelDisabled,
  hiddenFields,
  saveLabel = "Save",
  savePending,
  saveFormAction,
  saveAndDownloadLabel = "Save and download",
  saveAndDownloadPending,
  saveAndDownloadFormAction,
  saveAndSendLabel = "Save and send",
  saveAndSendPending,
  saveAndSendFormAction,
}: {
  title: string
  description: string
  pdfBase64: string
  onCancel: () => void
  cancelDisabled?: boolean
  hiddenFields?: Record<string, string>
  saveLabel?: string
  savePending: boolean
  saveFormAction: (formData: FormData) => void
  saveAndDownloadLabel?: string
  saveAndDownloadPending?: boolean
  saveAndDownloadFormAction?: (formData: FormData) => void
  saveAndSendLabel?: string
  saveAndSendPending?: boolean
  saveAndSendFormAction?: (formData: FormData) => void
}) {
  const anyPending =
    savePending || Boolean(saveAndDownloadPending) || Boolean(saveAndSendPending)

  return (
    <div className="no-print fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form action={saveFormAction}>
            <HiddenFields fields={hiddenFields} />
            <button
              type="submit"
              disabled={anyPending}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {savePending ? "Saving…" : saveLabel}
            </button>
          </form>
          {saveAndDownloadFormAction ? (
            <form action={saveAndDownloadFormAction}>
              <HiddenFields fields={hiddenFields} />
              <button
                type="submit"
                disabled={anyPending}
                className="inline-flex h-9 items-center justify-center rounded-md border bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-50"
              >
                {saveAndDownloadPending ? "Saving…" : saveAndDownloadLabel}
              </button>
            </form>
          ) : null}
          {saveAndSendFormAction ? (
            <form action={saveAndSendFormAction}>
              <HiddenFields fields={hiddenFields} />
              <button
                type="submit"
                disabled={anyPending}
                className="inline-flex h-9 items-center justify-center rounded-md border bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-50"
              >
                {saveAndSendPending ? "Saving…" : saveAndSendLabel}
              </button>
            </form>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            disabled={anyPending || cancelDisabled}
            className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <PdfViewer pdfBase64={pdfBase64} title={title} />
      </div>
    </div>
  )
}
