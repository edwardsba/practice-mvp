"use client"

import { useState, type ReactNode } from "react"

import type { ContextStripLine } from "@/lib/client-background/form-context"
import { cn } from "@/lib/utils"

/**
 * Grey strip under the panel title: pre-filled context as plain text with
 * optional "Change" links that swap a line for its dropdown in place.
 */
export function ContextStrip({
  lines,
  readOnly = false,
  editors,
}: {
  lines: ContextStripLine[]
  readOnly?: boolean
  /** When Change is tapped, render this editor for that line key. */
  editors?: Partial<Record<ContextStripLine["key"], ReactNode>>
}) {
  const [editing, setEditing] = useState<ContextStripLine["key"] | null>(null)

  if (lines.length === 0) return null

  return (
    <div className="mb-4 space-y-1 rounded-md bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
      {lines.map((line, index) => {
        const isEditing = !readOnly && editing === line.key
        const editor = editors?.[line.key]
        if (isEditing && editor) {
          return (
            <div key={`${line.key}-${index}`} className="space-y-1">
              {editor}
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setEditing(null)}
              >
                Done
              </button>
            </div>
          )
        }
        return (
          <p key={`${line.key}-${index}`} className="leading-snug">
            <span className="font-medium text-foreground/80">{line.label}:</span> {line.text}
            {!readOnly && editor ? (
              <>
                {" "}
                <button
                  type="button"
                  className={cn("text-primary underline-offset-2 hover:underline")}
                  onClick={() => setEditing(line.key)}
                >
                  Change
                </button>
              </>
            ) : null}
          </p>
        )
      })}
    </div>
  )
}
