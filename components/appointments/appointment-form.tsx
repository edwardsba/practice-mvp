"use client"

import Link from "next/link"
import { useActionState, useCallback, useEffect, useMemo, useState } from "react"

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
import { getAppointmentTypesForDropdown } from "@/lib/actions/appointment-types"
import {
  APPOINTMENT_DURATIONS,
  APPOINTMENT_MODE_LABELS,
  APPOINTMENT_MODES,
  buildAppointmentTimeOptions,
} from "@/lib/appointments/constants"
import {
  formatDateForInput,
  formatTimeForInput,
} from "@/lib/appointments/format"
import {
  resolveMode,
  type AppointmentTypeOption,
  type AvailabilityBlock,
} from "@/lib/appointments/resolve-mode"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full max-w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

const dateInputClassName = cn(
  "block h-9 w-full max-w-full min-w-0 appearance-none py-1",
  "[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
)

type ClientOption = {
  clientId: string
  firstName: string
  lastName: string
}

type PracticeMembership = {
  membershipId: string
  practiceName: string
}

type AppointmentInitialValues = {
  clientId: string
  appointmentDate: string
  appointmentTime: string
  durationMinutes: number
  mode?: string
  fundingApprovalId?: string | null
  appointmentTypeId?: string | null
  membershipId?: string | null
  notes: string | null
}

export function AppointmentForm({
  action,
  clients,
  practiceId,
  availabilityBlocks,
  practiceMemberships,
  initialValues,
  submitLabel,
  cancelHref,
}: {
  action: (
    prevState: AppointmentFormState,
    formData: FormData
  ) => Promise<AppointmentFormState>
  clients: ClientOption[]
  practiceId: string
  availabilityBlocks: AvailabilityBlock[]
  practiceMemberships: PracticeMembership[]
  initialValues?: AppointmentInitialValues
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [selectedClientId, setSelectedClientId] = useState(
    initialValues?.clientId ?? ""
  )
  const [selectedDate, setSelectedDate] = useState(
    formatDateForInput(initialValues?.appointmentDate ?? null)
  )
  const [selectedTime, setSelectedTime] = useState(
    formatTimeForInput(initialValues?.appointmentTime ?? null)
  )
  const [selectedFundingApprovalClaimTypeId, setSelectedFundingApprovalClaimTypeId] =
    useState<string | null>(null)
  const [appointmentTypeOptions, setAppointmentTypeOptions] = useState<
    AppointmentTypeOption[]
  >([])
  const [loadingAppointmentTypes, setLoadingAppointmentTypes] = useState(false)
  const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState(
    initialValues?.appointmentTypeId ?? ""
  )
  const [duration, setDuration] = useState(
    String(initialValues?.durationMinutes ?? 50)
  )
  const [mode, setMode] = useState(initialValues?.mode ?? "face_to_face")
  const [membershipId, setMembershipId] = useState(
    initialValues?.membershipId ?? ""
  )
  const [fundingApprovalSelected, setFundingApprovalSelected] = useState(false)

  const timeOptions = buildAppointmentTimeOptions()

  const selectedAppointmentType = useMemo(
    () =>
      appointmentTypeOptions.find(
        (option) => option.appointmentTypeId === selectedAppointmentTypeId
      ) ?? null,
    [appointmentTypeOptions, selectedAppointmentTypeId]
  )

  const handleFundingApprovalChange = useCallback(
    (fundingApprovalId: string, claimTypeId: string | null) => {
      setFundingApprovalSelected(true)
      setSelectedFundingApprovalClaimTypeId(claimTypeId)
    },
    []
  )

  useEffect(() => {
    if (!selectedClientId || !fundingApprovalSelected) {
      return
    }

    let cancelled = false
    setLoadingAppointmentTypes(true)

    getAppointmentTypesForDropdown(
      practiceId,
      selectedFundingApprovalClaimTypeId
    )
      .then((results) => {
        if (!cancelled) {
          setAppointmentTypeOptions(results)
          setSelectedAppointmentTypeId((current) => {
            if (current) return current
            return pickAppointmentTypeByMode(
              results,
              resolveMode(
                selectedDate,
                selectedTime,
                null,
                availabilityBlocks
              )
            )
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAppointmentTypes(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    practiceId,
    selectedClientId,
    selectedFundingApprovalClaimTypeId,
    fundingApprovalSelected,
    selectedDate,
    selectedTime,
    availabilityBlocks,
  ])

  useEffect(() => {
    if (practiceMemberships.length === 1 && !membershipId) {
      setMembershipId(practiceMemberships[0].membershipId)
    }
  }, [practiceMemberships, membershipId])

  useEffect(() => {
    if (!selectedAppointmentType) return
    setDuration(String(selectedAppointmentType.durationMinutes))
  }, [selectedAppointmentType])

  useEffect(() => {
    const resolved = resolveMode(
      selectedDate,
      selectedTime,
      selectedAppointmentType,
      availabilityBlocks
    )
    setMode(resolved)
  }, [
    selectedDate,
    selectedTime,
    selectedAppointmentType,
    availabilityBlocks,
  ])

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

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="appointment_date">Date</Label>
              <Input
                id="appointment_date"
                name="appointment_date"
                type="date"
                required
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className={dateInputClassName}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="appointment_time">Time</Label>
              <select
                id="appointment_time"
                name="appointment_time"
                required
                value={selectedTime}
                onChange={(event) => setSelectedTime(event.target.value)}
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

          <div className="min-w-0 space-y-2">
            <Label htmlFor="funding_approval_id">Funding approval</Label>
            <FundingApprovalSelect
              key={selectedClientId}
              clientId={selectedClientId}
              defaultValue={initialValues?.fundingApprovalId}
              onSelectionChange={handleFundingApprovalChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment_type_id">Appointment type</Label>
            <select
              id="appointment_type_id"
              name="appointment_type_id"
              value={selectedAppointmentTypeId}
              onChange={(event) =>
                setSelectedAppointmentTypeId(event.target.value)
              }
              disabled={!selectedClientId || loadingAppointmentTypes}
              className={selectClassName}
            >
              <option value="">Select appointment type</option>
              {appointmentTypeOptions.map((option) => (
                <option
                  key={option.appointmentTypeId}
                  value={option.appointmentTypeId}
                >
                  {option.nickname}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration</Label>
              <select
                id="duration_minutes"
                name="duration_minutes"
                required
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className={selectClassName}
              >
                {APPOINTMENT_DURATIONS.map((durationOption) => (
                  <option key={durationOption} value={durationOption}>
                    {durationOption} min
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mode">Mode</Label>
              <select
                id="mode"
                name="mode"
                required
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                className={selectClassName}
              >
                {APPOINTMENT_MODES.map((modeOption) => (
                  <option key={modeOption} value={modeOption}>
                    {APPOINTMENT_MODE_LABELS[modeOption]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="membership_id">Location</Label>
              <select
                id="membership_id"
                name="membership_id"
                value={membershipId}
                onChange={(event) => setMembershipId(event.target.value)}
                className={selectClassName}
              >
                <option value="">Select practice</option>
                {practiceMemberships.map((membership) => (
                  <option
                    key={membership.membershipId}
                    value={membership.membershipId}
                  >
                    {membership.practiceName}
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

function pickAppointmentTypeByMode(
  options: AppointmentTypeOption[],
  resolvedMode: string
): string {
  if (options.length === 0) return ""

  if (resolvedMode === "online") {
    const match = options.find((option) => option.mode === "online")
    if (match) return match.appointmentTypeId
  }

  if (resolvedMode === "face_to_face") {
    const match = options.find((option) => option.mode === "face_to_face")
    if (match) return match.appointmentTypeId
  }

  return options[0].appointmentTypeId
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
