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

        // Read as text first rather than res.json() directly — if something upstream
        // (auth redirect, a platform-level error page, a crash before the route's own
        // JSON.stringify) returns a non-JSON body, res.json() throws immediately and
        // all we'd ever see is the generic network-error message below, with no way to
        // tell that apart from an actual dropped connection. Reading as text first lets
        // a bad body show up as its own distinct, diagnosable error state instead.
        const rawText = await res.text()
        let data: ImportSuccessResponse | ImportErrorResponse | null = null
        try {
          data = JSON.parse(rawText) as ImportSuccessResponse | ImportErrorResponse
        } catch {
          data = null
        }

        if (data && res.ok && isSuccessResponse(data)) {
          updateStatus(i, {
            state: "success",
            kind: data.kind,
            mergedIntoExisting: data.merged_into_existing,
          })
        } else if (data && !isSuccessResponse(data)) {
          updateStatus(i, {
            state: "error",
            message: `${data.error}${data.code ? ` (${data.code})` : ""}`,
          })
        } else {
          // Response wasn't JSON at all, or was JSON but not in the expected shape —
          // surface the status code and a snippet of the raw body so this is
          // diagnosable from the dialog alone, without needing Vercel's function logs.
          console.error("SAGE-SR import: unexpected response", {
            status: res.status,
            body: rawText,
          })
          updateStatus(i, {
            state: "error",
            message: `Unexpected response (HTTP ${res.status}): ${rawText.slice(0, 200) || "(empty body)"}`,
          })
        }
      } catch (err) {
        console.error("SAGE-SR import: request failed", err)
        updateStatus(i, {
          state: "error",
          message:
            "Request never reached the server — check your connection and try again.",
        })
      }
    }

    setImporting(false)
    // Don't router.refresh() here. Refreshing remounts this server-rendered page
    // and Radix closes the dialog, which wipes the per-file errors before they
    // can be read. Refresh on close instead, after the user has seen the results.
  }

  function handleOpenChange(nextOpen: boolean) {
    if (importing) return // don't let the dialog close mid-upload
    if (!nextOpen) {
      const shouldRefresh = entries.some(
        (entry) =>
          entry.status.state === "success" || entry.status.state === "error"
      )
      setOpen(false)
      setEntries([])
      if (shouldRefresh) router.refresh()
      return
    }
    setOpen(true)
  }

  async function copyErrors() {
    const lines = entries
      .filter(
        (entry): entry is FileEntry & { status: { state: "error"; message: string } } =>
          entry.status.state === "error"
      )
      .map((entry) => `${entry.file.name}: ${entry.status.message}`)
    await navigator.clipboard.writeText(lines.join("\n"))
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
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(event) => {
          // Keep results on screen until Done is clicked — a click-outside would
          // otherwise close the dialog and lose the error text (which is what
          // happened on the last failed upload).
          if (importing || allDone) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (importing) event.preventDefault()
        }}
      >
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
            <ul className="space-y-3 rounded-lg border p-3">
              {entries.map((entry, index) => (
                <li key={`${entry.file.name}-${index}`} className="space-y-1 text-sm">
                  <div className="truncate font-medium">{entry.file.name}</div>
                  <div className="text-muted-foreground">
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
                      <span className="block whitespace-pre-wrap break-words text-destructive">
                        {entry.status.message}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          {allDone ? (
            <>
              {entries.some((entry) => entry.status.state === "error") ? (
                <Button type="button" variant="outline" onClick={copyErrors}>
                  Copy errors
                </Button>
              ) : null}
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </>
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
