"use client"

import { useActionState } from "react"

import {
  finaliseSessionNote,
  type FinaliseSessionNoteState,
} from "@/app/session-notes/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const initialState: FinaliseSessionNoteState = {}

export function SessionNoteActions({
  sessionNoteId,
  status,
}: {
  sessionNoteId: string
  status: string
}) {
  const [state, formAction, pending] = useActionState(
    finaliseSessionNote.bind(null, sessionNoteId),
    initialState
  )

  const isFinalised = status === "finalised" || state.success

  function handlePrint() {
    window.print()
  }

  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-3">
      {isFinalised ? (
        <Badge variant="success">Finalised</Badge>
      ) : (
        <form action={formAction}>
          <Button type="submit" disabled={pending}>
            {pending ? "Finalising…" : "Finalise"}
          </Button>
        </form>
      )}
      <Button type="button" variant="outline" onClick={handlePrint}>
        Print
      </Button>
      {state.error ? (
        <p className="w-full text-sm text-destructive">{state.error}</p>
      ) : null}
    </div>
  )
}
