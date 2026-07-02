"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { XIcon } from "lucide-react"

import {
  upsertFundingApprovalType,
  type FundingFormState,
} from "@/lib/actions/funding"
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

type ReportRequirement = {
  appointmentNumber: number
  reportType: string
  reportTypeId?: string | null
}

type ReportTypeOption = {
  reportTypeId: string
  name: string
}

type InitialValues = {
  fundingApprovalTypeId?: string
  name?: string
  claimTypeId?: string | null
  durationMonths?: number | null
  appointmentsApproved?: number | null
  reports?: ReportRequirement[]
}

export function ApprovalTypeForm({
  practiceId,
  claimTypes,
  reportTypes,
  initialValues,
  cancelHref,
}: {
  practiceId: string
  claimTypes: ClaimTypeOption[]
  reportTypes: ReportTypeOption[]
  initialValues?: InitialValues
  cancelHref: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    upsertFundingApprovalType.bind(
      null,
      practiceId,
      initialValues?.fundingApprovalTypeId
    ) as (
      prevState: FundingFormState,
      formData: FormData
    ) => Promise<FundingFormState>,
    {} as FundingFormState
  )
  const [reports, setReports] = useState<ReportRequirement[]>(
    initialValues?.reports ?? []
  )

  useEffect(() => {
    if (state.success && state.fundingApprovalTypeId) {
      router.push(`/funding/approval-types/${state.fundingApprovalTypeId}`)
      router.refresh()
    }
  }, [state.success, state.fundingApprovalTypeId, router])

  const durationValue =
    initialValues?.durationMonths == null
      ? "none"
      : String(initialValues.durationMonths)

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialValues?.fundingApprovalTypeId
            ? "Edit funding approval type"
            : "Add funding approval type"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input
            type="hidden"
            name="reporting_requirements"
            value={JSON.stringify(reports)}
          />

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initialValues?.name ?? ""}
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
              <Label htmlFor="duration_months">Duration</Label>
              <select
                id="duration_months"
                name="duration_months"
                defaultValue={durationValue}
                className={selectClassName}
              >
                <option value="none">No limit</option>
                <option value="12">12 months</option>
                <option value="24">24 months</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointments_approved">No. of appointments</Label>
            <Input
              id="appointments_approved"
              name="appointments_approved"
              type="number"
              min={0}
              defaultValue={initialValues?.appointmentsApproved ?? ""}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Reporting requirements</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setReports((current) => [
                    ...current,
                    { appointmentNumber: 1, reportType: "", reportTypeId: null },
                  ])
                }
              >
                Add reporting requirement
              </Button>
            </div>
            {reports.map((report, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_2fr_auto]"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Appointment no.</Label>
                  <Input
                    type="number"
                    min={1}
                    value={report.appointmentNumber}
                    onChange={(event) =>
                      setReports((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                appointmentNumber: Number(event.target.value),
                              }
                            : row
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Report type</Label>
                  <select
                    value={report.reportTypeId ?? ""}
                    onChange={(event) => {
                      const selected = reportTypes.find(
                        (rt) => rt.reportTypeId === event.target.value
                      )
                      setReports((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                reportTypeId: selected?.reportTypeId ?? null,
                                reportType: selected?.name ?? "",
                              }
                            : row
                        )
                      )
                    }}
                    className={selectClassName}
                  >
                    <option value="">Select report type</option>
                    {reportTypes.map((rt) => (
                      <option key={rt.reportTypeId} value={rt.reportTypeId}>
                        {rt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove reporting requirement"
                    onClick={() =>
                      setReports((current) =>
                        current.filter((_, rowIndex) => rowIndex !== index)
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
            ))}
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
