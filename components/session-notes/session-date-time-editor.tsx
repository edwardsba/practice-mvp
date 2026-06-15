"use client"

import { useState, useTransition } from "react"

import { updateSessionNoteDateTime } from "@/app/session-notes/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildAppointmentTimeOptions } from "@/lib/appointments/constants"
import {
  formatAppointmentTime,
  formatDateForInput,
  formatTimeForInput,
} from "@/lib/appointments/format"
import {
  formatSessionNoteDate,
  formatSessionNoteTime,
} from "@/lib/session-notes/format"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

export function SessionDateTimeEditor({
  sessionNoteId,
  sessionDate,
  sessionTime,
  readOnly,
}: {
  sessionNoteId: string
  sessionDate: string
  sessionTime: string | null
  readOnly: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [currentDate, setCurrentDate] = useState(sessionDate)
  const [currentTime, setCurrentTime] = useState(sessionTime)
  const [date, setDate] = useState(formatDateForInput(sessionDate))
  const [time, setTime] = useState(sessionTime ? formatTimeForInput(sessionTime) : "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const timeOptions = buildAppointmentTimeOptions()

  const display = (
    <>
      {formatSessionNoteDate(currentDate)}
      {currentTime ? `, ${formatSessionNoteTime(currentTime)}` : ""}
    </>
  )

  if (readOnly) {
    return <p className="text-sm text-muted-foreground">{display}</p>
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{display}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setDate(formatDateForInput(currentDate))
            setTime(currentTime ? formatTimeForInput(currentTime) : "")
            setError(null)
            setEditing(true)
          }}
        >
          Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end">
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-9 w-40"
      />
      <select
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className={cn(selectClassName, "w-32")}
      >
        <option value="">No time</option>
        {timeOptions.map((option) => (
          <option key={option} value={option}>
            {formatAppointmentTime(option)}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await updateSessionNoteDateTime(
                sessionNoteId,
                date,
                time || null
              )
              if (result.error) {
                setError(result.error)
                return
              }
              setCurrentDate(date)
              setCurrentTime(time || null)
              setEditing(false)
            })
          }}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
