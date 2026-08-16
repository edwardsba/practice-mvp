"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

/** Human-readable labels for the 6 report kinds the API route can detect. Kept here
 *  rather than imported from lib/sage-sr, since that module's SageSrReportKind type
 *  also includes "unknown" and "narrative_note" which never reach this success path —
 *  a route response only ever carries one of these 6 once `ok: true`. */
const KIND_LABELS: Record<string, string> = {
  core_clinician: "Core Clinician Report",
  core_response: "Core Response Report",
  background: "Background Report",
  background_response: "Background Response Report",
  personality: "Personality Report",
  personality_response: "Personality Response Report",
}

type FileStatus =
  | { state: "pending" }
  | { state: "uploading" }
  | { state: "success"; kind: string; mergedIntoExisting: boolean }
  | { state: "error"; message: string }

interface FileEntry {
  file: File
  status: FileStatus
}

interface ImportSuccessResponse {
  ok: true
  module: string
  kind: string
  assessment_instance_id: string
  merged_into_existing: boolean
}

interface ImportErrorResponse {
  ok?: false
  error: string
  code?: string
}

function isSuccessResponse(
  data: ImportSuccessResponse | ImportErrorResponse
): data is ImportSuccessResponse {
  return data.ok === true
}

export function ImportSageSrDialog({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [importing, setImporting] = useState(false)

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setEntries(files.map((file) => ({ file, status: { state: "pending" } })))
    // Reset so selecting the exact same file(s) again after a failed run re-fires
    // onChange rather than being a no-op.
    e.target.value = ""
  }

  function updateStatus(index: number, status: FileStatus) {
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, status } : entry))
    )
  }

  async function handleImport() {
    setImporting(true)

    // Uploaded one at a time, deliberately not in parallel. importSageSrReport merges
    // a new file into an existing same-day instance for the same module by querying
    // for one first — two companion files (e.g. Core Clinician + Core Response)
    // uploaded in the same batch via Promise.all could both run that query before
    // either insert commits, each conclude nothing exists yet, and create two separate
    // instances instead of merging into one. Sequential upload avoids that race
    // entirely, at the cost of total time — acceptable here since this is a low-volume,
    // occasional admin action, not a bulk pipeline.
    for (let i = 0; i < entries.length; i++) {
      updateStatus(i, { state: "uploading" })

      const formData = new FormData()
      formData.append("file", entries[i].file)
      formData.append("client_id", clientId)

      try {
        const res = await fetch("/api/sage-sr/import", {
          method: "POST",
          body: formData,
        })
        const data = (await res.json()) as
          | ImportSuccessResponse
          | ImportErrorResponse

        if (res.ok && isSuccessResponse(data)) {
          updateStatus(i, {
            state: "success",
            kind: data.kind,
            mergedIntoExisting: data.merged_into_existing,
          })
        } else {
          updateStatus(i, {
            state: "error",
            message: !isSuccessResponse(data)
              ? data.error
              : "Import failed.",
          })
        }
      } catch {
        updateStatus(i, {
          state: "error",
          message: "Upload failed — check your connection and try again.",
        })
      }
    }

    setImporting(false)
    router.refresh()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (importing) return // don't let the dialog close mid-upload
    setOpen(nextOpen)
    if (!nextOpen) setEntries([])
  }

  const hasResults = entries.some((entry) => entry.status.state !== "pending")
  const allDone =
    entries.length > 0 &&
    entries.every(
      (entry) =>
        entry.status.state === "success" || entry.status.state === "error"
    )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Import SAGE-SR report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import SAGE-SR report</DialogTitle>
          <DialogDescription>
            Upload one or more SAGE-SR PDF reports downloaded from TeleSage.
            The report type is detected automatically from each file&apos;s
            content — select as many of the 6 files (Core, Background, and
            Personality, each with a Clinician and a Response report) as
            you have on hand.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sage-sr-files">PDF files</Label>
            <input
              id="sage-sr-files"
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFilesSelected}
              disabled={importing}
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm file:font-medium disabled:pointer-events-none disabled:opacity-50"
            />
          </div>

          {entries.length > 0 ? (
            <ul className="space-y-2 rounded-lg border p-3">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.file.name}-${index}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">{entry.file.name}</span>
                  <span className="flex-shrink-0 text-right text-muted-foreground">
                    {entry.status.state === "pending" ? "Ready to upload" : null}
                    {entry.status.state === "uploading" ? "Uploading…" : null}
                    {entry.status.state === "success" ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {KIND_LABELS[entry.status.kind] ?? entry.status.kind}
                        {entry.status.mergedIntoExisting
                          ? " — merged"
                          : " — imported"}
                      </span>
                    ) : null}
                    {entry.status.state === "error" ? (
                      <span className="text-destructive">
                        {entry.status.message}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          {allDone ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={entries.length === 0 || importing || hasResults}
              >
                {importing
                  ? "Importing…"
                  : `Import ${entries.length || ""} file${entries.length === 1 ? "" : "s"}`.trim()}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
