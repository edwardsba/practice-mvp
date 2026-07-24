"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export function SessionNotesEditor({
  notes,
  onNotesChange,
  readOnly,
}: {
  notes: string
  onNotesChange: (value: string) => void
  readOnly: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const sharedTextareaProps = {
    value: notes,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onNotesChange(e.target.value),
    readOnly,
    placeholder: "Start typing session notes…",
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Practitioner notes</CardTitle>
          {!readOnly ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
              Expand
            </Button>
          ) : null}
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Practitioner notes</p>
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
