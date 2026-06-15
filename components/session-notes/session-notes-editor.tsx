"use client"

import { useEffect, useRef, useState } from "react"

import { updateSessionNoteNotes } from "@/app/session-notes/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const AUTOSAVE_DELAY_MS = 1500

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function SessionNotesEditor({
  sessionNoteId,
  initialNotes,
  readOnly,
}: {
  sessionNoteId: string
  initialNotes: string
  readOnly: boolean
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(initialNotes)

  useEffect(() => {
    if (readOnly) return
    if (notes === lastSavedRef.current) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      setSaving(true)
      setError(null)
      updateSessionNoteNotes(sessionNoteId, notes)
        .then((result) => {
          if (result.error) {
            setError(result.error)
            return
          }
          lastSavedRef.current = notes
          setSavedAt(new Date())
        })
        .finally(() => setSaving(false))
    }, AUTOSAVE_DELAY_MS)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [notes, sessionNoteId, readOnly])

  let statusLabel = ""
  if (saving) {
    statusLabel = "Saving…"
  } else if (savedAt) {
    statusLabel = `Saved at ${formatSavedTime(savedAt)}`
  }

  const sharedTextareaProps = {
    value: notes,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
    readOnly,
    placeholder: "Start typing session notes…",
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Practitioner notes</CardTitle>
          <div className="flex items-center gap-3">
            {statusLabel ? (
              <span className="text-sm text-muted-foreground">{statusLabel}</span>
            ) : null}
            {error ? <span className="text-sm text-destructive">{error}</span> : null}
            {!readOnly ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
                Expand
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          {expanded ? (
            <p className="text-sm text-muted-foreground">Notes are open in fullscreen.</p>
          ) : (
            <Textarea
              {...sharedTextareaProps}
              className="h-full min-h-[280px] resize-none border-0 p-0 shadow-none focus-visible:ring-0"
            />
          )}
        </CardContent>
      </Card>

      {expanded ? (
        <div className="no-print fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Practitioner notes
              {statusLabel ? (
                <span className="ml-3 font-normal text-muted-foreground">{statusLabel}</span>
              ) : null}
            </p>
            <Button type="button" onClick={() => setExpanded(false)}>
              Done
            </Button>
          </div>
          <Textarea
            {...sharedTextareaProps}
            autoFocus
            className="flex-1 resize-none text-base"
          />
        </div>
      ) : null}
    </>
  )
}
