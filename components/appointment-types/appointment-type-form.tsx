"use client"

import Link from "next/link"
import { useActionState, useMemo, useState } from "react"
import { XIcon } from "lucide-react"

import {
  upsertAppointmentType,
  type AppointmentTypeFormState,
} from "@/lib/actions/appointment-types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

type ClaimTypeOption = {
  claimTypeId: string
  claimTypeName: string
}

type FeeRow = {
  fee: string
  tax: string
  startDate: string
  endDate: string
  status: "active" | "inactive"
}

type InitialValues = {
  appointmentTypeId?: string
  nickname?: string
  name?: string
  referenceNumber?: string | null
  claimTypeId?: string | null
  mode?: string | null
  durationMinutes?: number
  status?: string
  fees?: FeeRow[]
}

function emptyFeeRow(): FeeRow {
  return {
    fee: "",
    tax: "0",
    startDate: "",
    endDate: "",
    status: "active",
  }
}

function calculateTotal(fee: string, tax: string) {
  const feeValue = Number(fee)
  const taxValue = Number(tax)
  if (Number.isNaN(feeValue) || Number.isNaN(taxValue)) return "0.00"
  return (feeValue + taxValue).toFixed(2)
}

export function AppointmentTypeForm({
  practiceId,
  claimTypes,
  initialValues,
  cancelHref,
}: {
  practiceId: string
  claimTypes: ClaimTypeOption[]
  initialValues?: InitialValues
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(
    upsertAppointmentType.bind(
      null,
      practiceId,
      initialValues?.appointmentTypeId
    ) as (
      prevState: AppointmentTypeFormState,
      formData: FormData
    ) => Promise<AppointmentTypeFormState>,
    {} as AppointmentTypeFormState
  )
  const [feeRows, setFeeRows] = useState<FeeRow[]>(
    initialValues?.fees?.length ? initialValues.fees : [emptyFeeRow()]
  )

  const feeRowsJson = useMemo(
    () =>
      JSON.stringify(
        feeRows.map((row) => ({
          fee: row.fee,
          tax: row.tax,
          startDate: row.startDate,
          endDate: row.endDate.trim() || null,
          status: row.status,
        }))
      ),
    [feeRows]
  )

  function updateFeeRow(index: number, patch: Partial<FeeRow>) {
    setFeeRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    )
  }

  function addFeeRow() {
    setFeeRows((current) => [...current, emptyFeeRow()])
  }

  function removeFeeRow(index: number) {
    setFeeRows((current) =>
      current.length <= 1 ? current : current.filter((_, i) => i !== index)
    )
  }

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>
          {initialValues?.appointmentTypeId
            ? "Edit appointment type"
            : "Add appointment type"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="fee_rows" value={feeRowsJson} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                name="nickname"
                required
                defaultValue={initialValues?.nickname ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={initialValues?.name ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_number">Reference number</Label>
            <Input
              id="reference_number"
              name="reference_number"
              defaultValue={initialValues?.referenceNumber ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="claim_type_id">Claim type</Label>
              <select
                id="claim_type_id"
                name="claim_type_id"
                defaultValue={initialValues?.claimTypeId ?? ""}
                className={selectClassName}
              >
                <option value="">Select claim type</option>
                {claimTypes.map((type) => (
                  <option key={type.claimTypeId} value={type.claimTypeId}>
                    {type.claimTypeName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mode">Mode</Label>
              <select
                id="mode"
                name="mode"
                defaultValue={initialValues?.mode ?? ""}
                className={selectClassName}
              >
                <option value="">No default</option>
                <option value="face_to_face">Face to face</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min={1}
                defaultValue={initialValues?.durationMinutes ?? 50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={initialValues?.status ?? "active"}
                className={selectClassName}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label>Fee details</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFeeRow}>
                Add fee row
              </Button>
            </div>

            <div className="space-y-4">
              {feeRows.map((row, index) => (
                <div
                  key={`fee-row-${index}`}
                  className="rounded-lg border p-4 space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`fee_${index}`}>Fee</Label>
                      <Input
                        id={`fee_${index}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.fee}
                        onChange={(e) =>
                          updateFeeRow(index, { fee: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`tax_${index}`}>Tax</Label>
                      <Input
                        id={`tax_${index}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.tax}
                        onChange={(e) =>
                          updateFeeRow(index, { tax: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total</Label>
                      <Input
                        readOnly
                        disabled
                        value={calculateTotal(row.fee, row.tax)}
                        className="bg-muted text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`start_date_${index}`}>Start date</Label>
                      <Input
                        id={`start_date_${index}`}
                        type="date"
                        value={row.startDate}
                        onChange={(e) =>
                          updateFeeRow(index, { startDate: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`end_date_${index}`}>End date</Label>
                      <Input
                        id={`end_date_${index}`}
                        type="date"
                        value={row.endDate}
                        onChange={(e) =>
                          updateFeeRow(index, { endDate: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`fee_status_${index}`}>Status</Label>
                      <select
                        id={`fee_status_${index}`}
                        value={row.status}
                        onChange={(e) =>
                          updateFeeRow(index, {
                            status: e.target.value as FeeRow["status"],
                          })
                        }
                        className={selectClassName}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFeeRow(index)}
                      disabled={feeRows.length <= 1}
                      aria-label="Remove fee row"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
