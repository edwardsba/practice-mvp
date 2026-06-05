"use client"

import Link from "next/link"
import { useActionState } from "react"

import type { SessionNoteFormState } from "@/app/session-notes/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { buildAppointmentTimeOptions } from "@/lib/appointments/constants"
import {
  formatAppointmentTime,
  formatDateForInput,
  formatTimeForInput,
  todayDateString,
} from "@/lib/appointments/format"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

type ClientOption = {
  clientId: string
  firstName: string
  lastName: string
}

type SessionNoteInitialValues = {
  clientId: string
  sessionDate: string
  sessionTime: string | null
  practitionerNotes: string | null
  appointmentId: string | null
}

export function SessionNoteForm({
  action,
  clients,
  initialValues,
  submitLabel,
  cancelHref,
  lockClient = false,
}: {
  action: (
    prevState: SessionNoteFormState,
    formData: FormData
  ) => Promise<SessionNoteFormState>
  clients: ClientOption[]
  initialValues?: SessionNoteInitialValues
  submitLabel: string
  cancelHref: string
  lockClient?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const timeOptions = buildAppointmentTimeOptions()

  const clientId = initialValues?.clientId ?? ""
  const sessionDate = initialValues?.sessionDate ?? todayDateString()
  const sessionTime = initialValues?.sessionTime
    ? formatTimeForInput(initialValues.sessionTime)
    : ""
  const practitionerNotes = initialValues?.practitionerNotes ?? ""
  const appointmentId = initialValues?.appointmentId ?? ""

  return (
    <form action={formAction} className="space-y-6">
      {appointmentId ? (
        <input type="hidden" name="appointment_id" value={appointmentId} />
      ) : null}
      {lockClient ? (
        <input type="hidden" name="client_id" value={clientId} />
      ) : null}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Session details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!lockClient ? (
            <div className="space-y-2">
              <Label htmlFor="client_id">Client</Label>
              <select
                id="client_id"
                name="client_id"
                required
                defaultValue={clientId}
                className={selectClassName}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.clientId} value={client.clientId}>
                    {client.lastName}, {client.firstName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="session_date">Date</Label>
            <Input
              id="session_date"
              name="session_date"
              type="date"
              required
              defaultValue={formatDateForInput(sessionDate)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_time">Time</Label>
            <select
              id="session_time"
              name="session_time"
              defaultValue={sessionTime}
              className={selectClassName}
            >
              <option value="">No time specified</option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {formatAppointmentTime(time)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="practitioner_notes">Practitioner notes</Label>
            <Textarea
              id="practitioner_notes"
              name="practitioner_notes"
              rows={8}
              defaultValue={practitionerNotes}
              placeholder="Enter session notes…"
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
