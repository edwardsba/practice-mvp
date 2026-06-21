"use client"

import { useState, useTransition } from "react"

import { getSessionNotePdfDownloadUrl } from "@/app/session-notes/actions"
import { Button } from "@/components/ui/button"

export function SessionNotePdfDownloadLink({
  sessionNoteId,
}: {
  sessionNoteId: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-sm"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await getSessionNotePdfDownloadUrl(sessionNoteId)
            if (result.error) {
              setError(result.error)
              return
            }
            if (result.url) {
              window.open(result.url, "_blank", "noopener,noreferrer")
            }
          })
        }}
      >
        {pending ? "Preparing…" : "Download"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
