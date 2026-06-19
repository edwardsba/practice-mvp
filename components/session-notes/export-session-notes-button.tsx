"use client"

import { useActionState } from "react"

import {
  exportSessionNotePdfs,
  type ExportSessionNotesState,
} from "@/app/session-notes/actions"
import { Button } from "@/components/ui/button"
import { formatSessionNoteDate } from "@/lib/session-notes/format"

const initialState: ExportSessionNotesState = {}

export function ExportSessionNotesButton({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(
    exportSessionNotePdfs.bind(null, clientId),
    initialState
  )

  return (
    <div className="space-y-3">
      <form action={formAction}>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Preparing…" : "Export session notes (PDF)"}
        </Button>
      </form>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.links && state.links.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {state.links.length} PDF{state.links.length !== 1 ? "s" : ""} ready
            — links expire in 5 minutes:
          </p>
          <ul className="space-y-1">
            {state.links.map((link) => (
              <li key={link.sessionNoteId}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {formatSessionNoteDate(link.sessionDate)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
