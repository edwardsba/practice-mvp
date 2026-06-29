"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  upsertFundingApproval,
  type FundingFormState,
} from "@/lib/actions/funding"
import {
  clearFundingApprovalDraft,
  loadFundingApprovalDraft,
  saveFundingApprovalDraft,
} from "@/lib/funding/funding-approval-draft"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  addMonthsToDateString,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUSES,
  formatDisplayDate,
  isMedicareClaimType,
} from "@/lib/funding/format"
import {
  formatAppointmentDate,
  formatAppointmentTime,
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

type ApprovalTypeOption = {
  fundingApprovalTypeId: string
  name: string
  claimTypeId: string | null
  durationMonths: number | null
  appointmentsApproved: number | null
  reports: Array<{ appointmentNumber: number; reportType: string }>
}

type ClaimOption = {
  claimId: string
  clientId: string
  claimTypeId: string | null
  claimTypeName: string
  startDate?: string | null
}

type ReferrerOption = {
  professionalId: string
  firstName: string
  lastName: string
  organisationName: string | null
}

type ReportOption = {
  simpleReportId: string
  reportType: string
  reportDate: string | null
  createdAt: Date
}

type LinkedAppointment = {
  appointmentDate: string
  appointmentTime: string
  location: string | null
}

type ReportLinkRow = {
  appointmentNumber: number
  reportType: string
  simpleReportId: string | null
}

type InitialValues = {
  fundingApprovalId?: string
  clientId?: string
  fundingApprovalTypeId?: string | null
  claimId?: string | null
  referrerId?: string | null
  startDate?: string | null
  endDate?: string | null
  appointmentsApproved?: number | null
  appointmentsAttended?: number
  approvalStatus?: string
  linkedAppointments?: LinkedAppointment[]
  reportLinks?: ReportLinkRow[]
}

export function FundingApprovalForm({
  clients,
  approvalTypes,
  claims,
  referrers,
  clientReports,
  initialValues,
  cancelHref,
  returnTo,
}: {
  clients: ClientOption[]
  approvalTypes: ApprovalTypeOption[]
  claims: ClaimOption[]
  referrers: ReferrerOption[]
  clientReports: ReportOption[]
  initialValues?: InitialValues
  cancelHref: string
  returnTo?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
  const draftId = initialValues?.fundingApprovalId ?? "new"
  const skipNextTypeAutoFill = useRef(false)
  const [state, formAction, pending] = useActionState(
    upsertFundingApproval.bind(null, initialValues?.fundingApprovalId) as (
      prevState: FundingFormState,
      formData: FormData
    ) => Promise<FundingFormState>,
    {} as FundingFormState
  )

  const [clientId, setClientId] = useState(initialValues?.clientId ?? "")
  const [claimId, setClaimId] = useState(initialValues?.claimId ?? "")
  const [referrerId, setReferrerId] = useState(initialValues?.referrerId ?? "")
  const [approvalTypeId, setApprovalTypeId] = useState(
    initialValues?.fundingApprovalTypeId ?? ""
  )
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? "")
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? "")
  const [appointmentsApproved, setAppointmentsApproved] = useState(
    initialValues?.appointmentsApproved?.toString() ?? ""
  )

  const selectedType = useMemo(
    () =>
      approvalTypes.find(
        (type) => type.fundingApprovalTypeId === approvalTypeId
      ),
    [approvalTypes, approvalTypeId]
  )

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.claimId === claimId) ?? null,
    [claims, claimId]
  )

  const isMedicare = isMedicareClaimType(selectedClaim?.claimTypeName)

  const filteredApprovalTypes = useMemo(
    () =>
      selectedClaim?.claimTypeId
        ? approvalTypes.filter(
            (type) => type.claimTypeId === selectedClaim.claimTypeId
          )
        : approvalTypes,
    [approvalTypes, selectedClaim]
  )

  const filteredClaims = useMemo(
    () => claims.filter((claim) => !clientId || claim.clientId === clientId),
    [claims, clientId]
  )

  const [reportLinks, setReportLinks] = useState<ReportLinkRow[]>(
    initialValues?.reportLinks ??
      selectedType?.reports.map((report) => ({
        appointmentNumber: report.appointmentNumber,
        reportType: report.reportType,
        simpleReportId: null,
      })) ??
      []
  )

  useEffect(() => {
    const draft = loadFundingApprovalDraft(draftId)
    if (draft) {
      skipNextTypeAutoFill.current = true
      setClientId(draft.clientId || clientId)
      setApprovalTypeId(draft.approvalTypeId || approvalTypeId)
      setClaimId(draft.claimId || claimId)
      setReferrerId(draft.referrerId || referrerId)
      setStartDate(draft.startDate || startDate)
      setEndDate(draft.endDate || endDate)
      setAppointmentsApproved(
        draft.appointmentsApproved || appointmentsApproved
      )
      if (draft.reportLinks?.length) setReportLinks(draft.reportLinks)
      clearFundingApprovalDraft(draftId)
    }

    const params = new URLSearchParams(window.location.search)
    const createdClaimId = params.get("created_claim_id")
    if (createdClaimId) {
      setClaimId(createdClaimId)
    }

    const createdReferrerId = params.get("created_referrer_id")
    if (createdReferrerId) {
      setReferrerId(createdReferrerId)
    }

    if (createdClaimId || createdReferrerId) {
      const cleanParams = new URLSearchParams(window.location.search)
      cleanParams.delete("created_claim_id")
      cleanParams.delete("created_referrer_id")
      const cleanUrl = `${window.location.pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ""}`
      window.history.replaceState({}, "", cleanUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedType) return
    if (skipNextTypeAutoFill.current) {
      skipNextTypeAutoFill.current = false
      return
    }
    if (!initialValues?.fundingApprovalId) {
      setAppointmentsApproved(
        selectedType.appointmentsApproved?.toString() ?? ""
      )
      if (startDate && selectedType.durationMonths) {
        setEndDate(
          addMonthsToDateString(startDate, selectedType.durationMonths) ?? ""
        )
      }
      setReportLinks(
        selectedType.reports.map((report) => ({
          appointmentNumber: report.appointmentNumber,
          reportType: report.reportType,
          simpleReportId: null,
        }))
      )
    }
  }, [approvalTypeId, selectedType, startDate, initialValues?.fundingApprovalId])

  useEffect(() => {
    if (state.success && state.fundingApprovalId) {
      if (returnTo) {
        router.push(returnTo)
      } else {
        router.push(`/funding/approvals/${state.fundingApprovalId}`)
      }
      router.refresh()
    }
  }, [state.success, state.fundingApprovalId, returnTo, router])

  function saveCurrentDraft() {
    saveFundingApprovalDraft(draftId, {
      clientId,
      approvalTypeId,
      claimId,
      referrerId,
      startDate,
      endDate,
      appointmentsApproved,
      reportLinks,
    })
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>
          {initialValues?.fundingApprovalId
            ? "Edit funding approval"
            : "Add funding approval"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="report_links" value={JSON.stringify(reportLinks)} />

          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <select
              id="client_id"
              name="client_id"
              required
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value)
                setClaimId("")
              }}
              disabled={Boolean(initialValues?.fundingApprovalId)}
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
            {initialValues?.fundingApprovalId && clientId ? (
              <input type="hidden" name="client_id" value={clientId} />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="claim_id">Claim</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="claim_id"
                name="claim_id"
                required
                value={claimId}
                onChange={(event) => {
                  const newClaimId = event.target.value
                  setClaimId(newClaimId)

                  const newClaim = claims.find((c) => c.claimId === newClaimId)
                  if (newClaim?.claimTypeId && approvalTypeId) {
                    const stillValid = approvalTypes.some(
                      (type) =>
                        type.fundingApprovalTypeId === approvalTypeId &&
                        type.claimTypeId === newClaim.claimTypeId
                    )
                    if (!stillValid) setApprovalTypeId("")
                  }
                  if (!newClaimId) setApprovalTypeId("")
                }}
                className={selectClassName}
              >
                <option value="" disabled>
                  Select claim
                </option>
                {filteredClaims.map((claim) => (
                  <option key={claim.claimId} value={claim.claimId}>
                    {claim.claimTypeName}
                    {claim.startDate ? ` (${claim.startDate})` : ""}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  saveCurrentDraft()
                  const returnToUrl = currentUrl
                  const claimUrl = `/funding/claims/new?${clientId ? `client_id=${clientId}&` : ""}returnTo=${encodeURIComponent(returnToUrl)}`
                  window.location.href = claimUrl
                }}
              >
                Add new claim
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="funding_approval_type_id">Funding approval type</Label>
            <select
              id="funding_approval_type_id"
              name="funding_approval_type_id"
              required
              value={approvalTypeId}
              onChange={(event) => setApprovalTypeId(event.target.value)}
              className={selectClassName}
            >
              <option value="" disabled>
                Select approval type
              </option>
              {filteredApprovalTypes.map((type) => (
                <option
                  key={type.fundingApprovalTypeId}
                  value={type.fundingApprovalTypeId}
                >
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referrer_id">
              Referrer
              {isMedicare ? (
                <span className="ml-1 text-destructive">*</span>
              ) : null}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="referrer_id"
                name="referrer_id"
                required={isMedicare}
                value={referrerId}
                onChange={(event) => setReferrerId(event.target.value)}
                className={selectClassName}
              >
                <option value="">Select referrer</option>
                {referrers.map((referrer) => (
                  <option
                    key={referrer.professionalId}
                    value={referrer.professionalId}
                  >
                    {referrer.lastName}, {referrer.firstName}
                    {referrer.organisationName
                      ? ` — ${referrer.organisationName}`
                      : ""}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  saveCurrentDraft()
                  const returnToUrl = currentUrl
                  const professionalUrl = `/contacts/professionals/new?returnTo=${encodeURIComponent(returnToUrl)}`
                  window.location.href = professionalUrl
                }}
              >
                Add new referrer
              </Button>
            </div>
            {isMedicare ? (
              <p className="text-xs text-muted-foreground">
                Required for Medicare claims.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value
                  setStartDate(value)
                  if (selectedType?.durationMonths) {
                    setEndDate(
                      addMonthsToDateString(
                        value,
                        selectedType.durationMonths
                      ) ?? ""
                    )
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appointments_approved">Appointments approved</Label>
              <Input
                id="appointments_approved"
                name="appointments_approved"
                type="number"
                min={0}
                value={appointmentsApproved}
                onChange={(event) =>
                  setAppointmentsApproved(event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Appointments attended</Label>
              <Input
                readOnly
                value={initialValues?.appointmentsAttended ?? 0}
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval_status">Approval status</Label>
            <select
              id="approval_status"
              name="approval_status"
              defaultValue={initialValues?.approvalStatus ?? "active"}
              className={selectClassName}
            >
              {APPROVAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPROVAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {reportLinks.length > 0 ? (
            <div className="space-y-2">
              <Label>Reporting</Label>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report type</TableHead>
                      <TableHead>Linked report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportLinks.map((link, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">
                          {link.reportType}
                        </TableCell>
                        <TableCell>
                          <select
                            value={link.simpleReportId ?? ""}
                            onChange={(event) =>
                              setReportLinks((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        simpleReportId:
                                          event.target.value || null,
                                      }
                                    : row
                                )
                              )
                            }
                            className={selectClassName}
                          >
                            <option value="">Select report</option>
                            {clientReports.map((report) => (
                              <option
                                key={report.simpleReportId}
                                value={report.simpleReportId}
                              >
                                {report.reportType} —{" "}
                                {formatDisplayDate(
                                  report.reportDate ??
                                    report.createdAt.toISOString().slice(0, 10)
                                )}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

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
