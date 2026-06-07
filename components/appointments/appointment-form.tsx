"use client"

import Link from "next/link"
import { useActionState, useState } from "react"

import { FundingApprovalSelect } from "@/components/appointments/funding-approval-select"

import type { AppointmentFormState } from "@/app/appointments/actions"
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
import {
  APPOINTMENT_DURATIONS,
  APPOINTMENT_MODE_LABELS,
  APPOINTMENT_MODES,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  buildAppointmentTimeOptions,
} from "@/lib/appointments/constants"
import {
  formatDateForInput,
  formatTimeForInput,
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

type AppointmentInitialValues = {
  clientId: string
  appointmentDate: string
  appointmentTime: string
  durationMinutes: number
  location: string | null
  mode?: string
  fundingApprovalId?: string | null
  status: string
  notes: string | null
}

export function AppointmentForm({
  action,
  clients,
  initialValues,
  submitLabel,
  cancelHref,
}: {
  action: (
    prevState: AppointmentFormState,
    formData: FormData
  ) => Promise<AppointmentFormState>
  clients: ClientOption[]
  initialValues?: AppointmentInitialValues
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [selectedClientId, setSelectedClientId] = useState(
    initialValues?.clientId ?? ""
  )
  const timeOptions = buildAppointmentTimeOptions()

  return (
    <form action={formAction} className="space-y-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Appointment details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <select
              id="client_id"
              name="client_id"
              required
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              className={selectClassName}
            >
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((client) => (
                <option key={client.clientId} value={client.clientId}>
                  {client.lastName}, {client.firstName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="funding_approval_id">Funding approval</Label>
            <FundingApprovalSelect
              key={selectedClientId}
              clientId={selectedClientId}
              defaultValue={initialValues?.fundingApprovalId}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appointment_date">Date</Label>
              <Input
                id="appointment_date"
                name="appointment_date"
                type="date"
                required
                defaultValue={formatDateForInput(
                  initialValues?.appointmentDate ?? null
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment_time">Time</Label>
              <select
                id="appointment_time"
                name="appointment_time"
                required
                defaultValue={formatTimeForInput(
                  initialValues?.appointmentTime ?? null
                )}
                className={selectClassName}
              >
                <option value="" disabled>
                  Select a time
                </option>
                {timeOptions.map((time) => (
                  <option key={time} value={time}>
                    {formatTimeLabel(time)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration</Label>
              <select
                id="duration_minutes"
                name="duration_minutes"
                required
                defaultValue={String(initialValues?.durationMinutes ?? 50)}
                className={selectClassName}
              >
                {APPOINTMENT_DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} min
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                required
                defaultValue={initialValues?.status ?? "scheduled"}
                className={selectClassName}
              >
                {APPOINTMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {APPOINTMENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                defaultValue={initialValues?.location ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mode">Mode</Label>
              <select
                id="mode"
                name="mode"
                required
                defaultValue={initialValues?.mode ?? "face_to_face"}
                className={selectClassName}
              >
                {APPOINTMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {APPOINTMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={initialValues?.notes ?? ""}
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}

function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map((part) => Number(part))
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
