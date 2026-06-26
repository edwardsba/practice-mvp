"use client"

import { useActionState, useCallback, useEffect, useState, useTransition } from "react"

import {
  fetchReportResultsForAppointments,
  fetchReportResultsForRange,
  saveReportDraft,
  type ReportPreviewRow,
  type SaveReportDraftState,
} from "@/app/clients/[client_id]/reports/actions"
import { ReportDocument } from "@/components/report/report-document"
import { ReportBtpResultsTable } from "@/components/report/btp-results-table"
import {
  ReportAsqResultsTable,
  ReportResultsTable,
} from "@/components/report/results-table"
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
import type { getClientFundingApprovalsForReport } from "@/lib/actions/funding"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import type { ReportRecipient, ReportSnapshot } from "@/lib/reports/snapshot"
import { resolveReportTitle } from "@/lib/reports/snapshot"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full max-w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

const dateInputClassName = cn(
  "block h-9 w-full max-w-full min-w-0 appearance-none py-1",
  "[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
)

const initialSaveState: SaveReportDraftState = {}

export function ReportForm({
  clientId,
  fundingApprovals,
  initialSnapshot,
}: {
  clientId: string
  fundingApprovals: Awaited<
    ReturnType<typeof getClientFundingApprovalsForReport>
  >
  initialSnapshot: Omit<
    ReportSnapshot,
    | "phq9Results"
    | "gad7Results"
    | "asqResults"
    | "assistResults"
    | "btpResults"
    | "clinicalSummaryText"
    | "recommendationsText"
    | "dateRangeStart"
    | "dateRangeEnd"
    | "generatedAt"
    | "reportTitle"
  >
}) {
  const [recipientType, setRecipientType] = useState("none")
  const [requirementId, setRequirementId] = useState<string>("")
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>(
    []
  )
  const [dateRangeStart, setDateRangeStart] = useState("")
  const [dateRangeEnd, setDateRangeEnd] = useState("")
  const [phq9Results, setPhq9Results] = useState<ReportPreviewRow[]>([])
  const [gad7Results, setGad7Results] = useState<ReportPreviewRow[]>([])
  const [asqResults, setAsqResults] = useState<ReportPreviewRow[]>([])
  const [assistResults, setAssistResults] = useState<ReportPreviewRow[]>([])
  const [btpResults, setBtpResults] = useState<
    import("@/lib/reports/snapshot").BtpReportResultRow[]
  >([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [clinicalSummary, setClinicalSummary] = useState("")
  const [recommendations, setRecommendations] = useState("")
  const [isPendingPreview, startPreviewTransition] = useTransition()
  const [saveState, saveAction, savePending] = useActionState(
    saveReportDraft.bind(null, clientId),
    initialSaveState
  )

  const isReferrer = recipientType.startsWith("referrer:")
  const approvalId = isReferrer ? recipientType.split(":")[1] ?? "" : ""
  const selectedApproval =
    fundingApprovals.find((fa) => fa.fundingApprovalId === approvalId) ?? null

  const selectedAppointmentDates = selectedApproval
    ? selectedApproval.appointments
        .filter((a) => selectedAppointmentIds.includes(a.appointmentId))
        .map((a) => a.appointmentDate)
        .sort()
    : []

  const derivedDateRangeStart = selectedAppointmentDates[0] ?? ""
  const derivedDateRangeEnd =
    selectedAppointmentDates[selectedAppointmentDates.length - 1] ?? ""

  const effectiveDateRangeStart = selectedApproval
    ? derivedDateRangeStart
    : dateRangeStart
  const effectiveDateRangeEnd = selectedApproval
    ? derivedDateRangeEnd
    : dateRangeEnd

  const loadPreview = useCallback(
    (apptIds: string[], start: string, end: string) => {
      if (selectedApproval) {
        if (apptIds.length === 0) {
          setPhq9Results([])
          setGad7Results([])
          setAsqResults([])
          setAssistResults([])
          setBtpResults([])
          setPreviewError(null)
          return
        }

        startPreviewTransition(async () => {
          const { preview, error } = await fetchReportResultsForAppointments(
            clientId,
            apptIds
          )
          setPhq9Results(preview.phq9Results)
          setGad7Results(preview.gad7Results)
          setAsqResults(preview.asqResults)
          setAssistResults(preview.assistResults)
          setBtpResults(preview.btpResults)
          setPreviewError(error ?? null)
        })
      } else {
        if (!start || !end) {
          setPhq9Results([])
          setGad7Results([])
          setAsqResults([])
          setAssistResults([])
          setBtpResults([])
          setPreviewError(null)
          return
        }

        startPreviewTransition(async () => {
          const { preview, error } = await fetchReportResultsForRange(
            clientId,
            start,
            end
          )
          setPhq9Results(preview.phq9Results)
          setGad7Results(preview.gad7Results)
          setAsqResults(preview.asqResults)
          setAssistResults(preview.assistResults)
          setBtpResults(preview.btpResults)
          setPreviewError(error ?? null)
        })
      }
    },
    [clientId, selectedApproval]
  )

  function handleStartChange(value: string) {
    setDateRangeStart(value)
    loadPreview([], value, dateRangeEnd)
  }

  function handleEndChange(value: string) {
    setDateRangeEnd(value)
    loadPreview([], dateRangeStart, value)
  }

  function handlePrint() {
    window.print()
  }

  useEffect(() => {
    if (selectedApproval) {
      const completed = selectedApproval.appointments
        .filter((a) => a.status === "completed")
        .map((a) => a.appointmentId)
      setSelectedAppointmentIds(completed)
    } else {
      setSelectedAppointmentIds([])
    }
  }, [selectedApproval])

  useEffect(() => {
    if (selectedApproval?.requirements?.length) {
      setRequirementId(selectedApproval.requirements[0].reportRequirementId)
    } else {
      setRequirementId("")
    }
  }, [selectedApproval])

  useEffect(() => {
    if (selectedApproval) {
      loadPreview(selectedAppointmentIds, derivedDateRangeStart, derivedDateRangeEnd)
    }
  }, [
    selectedApproval,
    selectedAppointmentIds,
    derivedDateRangeStart,
    derivedDateRangeEnd,
    loadPreview,
  ])

  const recipient: ReportRecipient =
    recipientType === "client"
      ? {
          type: "client",
          name: `${initialSnapshot.client.firstName} ${initialSnapshot.client.lastName}`,
          organisationName: null,
          streetAddress: null,
          postalAddress: null,
        }
      : selectedApproval
        ? {
            type: "referrer",
            name:
              [selectedApproval.referrerTitle, selectedApproval.referrerName]
                .filter(Boolean)
                .join(" ") || null,
            organisationName: selectedApproval.organisationName,
            streetAddress: selectedApproval.streetAddress,
            postalAddress: selectedApproval.postalAddress,
          }
        : {
            type: "none",
            name: null,
            organisationName: null,
            streetAddress: null,
            postalAddress: null,
          }

  const previewSnapshot: ReportSnapshot | null =
    effectiveDateRangeStart && effectiveDateRangeEnd
      ? {
          ...initialSnapshot,
          reportTitle: resolveReportTitle(),
          generatedAt: new Date().toISOString(),
          dateRangeStart: effectiveDateRangeStart,
          dateRangeEnd: effectiveDateRangeEnd,
          phq9Results,
          gad7Results,
          asqResults,
          assistResults,
          btpResults,
          clinicalSummaryText: clinicalSummary,
          recommendationsText: recommendations,
          recipient,
          fundingApproval: null,
          selectedAppointmentIds: selectedApproval ? selectedAppointmentIds : [],
        }
      : null

  const hasPreviewSource = selectedApproval
    ? selectedAppointmentIds.length > 0
    : Boolean(dateRangeStart && dateRangeEnd)

  const previewLoading = isPendingPreview && hasPreviewSource

  return (
    <>
      <div className="no-print space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recipient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient_type">Address report to</Label>
              <select
                id="recipient_type"
                name="recipient_type"
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
                className={selectClassName}
              >
                <option value="none">No recipient</option>
                <option value="client">Client</option>
                {fundingApprovals.length > 0 && (
                  <option disabled>── Funding approvals ──</option>
                )}
                {fundingApprovals.map((fa) => (
                  <option
                    key={fa.fundingApprovalId}
                    value={`referrer:${fa.fundingApprovalId}`}
                  >
                    {fa.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedApproval && selectedApproval.requirements.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="report_requirement">Report requirement</Label>
                <select
                  id="report_requirement"
                  value={requirementId}
                  onChange={(e) => setRequirementId(e.target.value)}
                  className={selectClassName}
                >
                  <option value="">No requirement selected</option>
                  {selectedApproval.requirements.map((req) => (
                    <option
                      key={req.reportRequirementId}
                      value={req.reportRequirementId}
                    >
                      {req.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedApproval && selectedApproval.requirements.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All report requirements for this approval are fulfilled.
              </p>
            )}
          </CardContent>
        </Card>

        {selectedApproval ? (
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedApproval.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No appointments linked to this funding approval.
                </p>
              ) : (
                selectedApproval.appointments.map((appt) => (
                  <label
                    key={appt.appointmentId}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAppointmentIds.includes(appt.appointmentId)}
                      onChange={(e) => {
                        setSelectedAppointmentIds((prev) =>
                          e.target.checked
                            ? [...prev, appt.appointmentId]
                            : prev.filter((id) => id !== appt.appointmentId)
                        )
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span>
                      {formatAppointmentDate(appt.appointmentDate)}{" "}
                      {formatAppointmentTime(appt.appointmentTime)}
                    </span>
                    <span className="text-muted-foreground capitalize">
                      {appt.status.replace("_", " ")}
                    </span>
                  </label>
                ))
              )}
              {selectedAppointmentDates.length > 0 && (
                <p className="pt-2 text-xs text-muted-foreground">
                  Reporting period: {derivedDateRangeStart} – {derivedDateRangeEnd}
                </p>
              )}
              {previewError ? (
                <p className="pt-2 text-sm text-destructive">{previewError}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Date range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="date_range_start">Start date</Label>
                  <Input
                    id="date_range_start"
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => handleStartChange(e.target.value)}
                    className={dateInputClassName}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="date_range_end">End date</Label>
                  <Input
                    id="date_range_end"
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => handleEndChange(e.target.value)}
                    className={dateInputClassName}
                  />
                </div>
              </div>
              {previewError ? (
                <p className="mt-3 text-sm text-destructive">{previewError}</p>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Results preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {!hasPreviewSource ? (
              <p className="text-sm text-muted-foreground">
                {selectedApproval
                  ? "Select at least one appointment to preview results."
                  : "Select a date range to preview results."}
              </p>
            ) : previewLoading ? (
              <p className="text-sm text-muted-foreground">Loading results…</p>
            ) : (
              <>
                <ReportResultsTable
                  title="PHQ-9 Results"
                  results={phq9Results}
                  emptyMessage="No PHQ-9 results in this date range."
                  showImpairment
                />
                <ReportResultsTable
                  title="GAD-7 Results"
                  results={gad7Results}
                  emptyMessage="No GAD-7 results in this date range."
                  showImpairment
                />
                <ReportAsqResultsTable
                  results={asqResults}
                  emptyMessage="No ASQ results in this date range."
                />
                <ReportResultsTable
                  title="ASSIST Results"
                  results={assistResults}
                  emptyMessage="No ASSIST results in this date range."
                  severityColumnLabel="Risk Level"
                  capitalizeSeverity={false}
                />
                <ReportBtpResultsTable
                  results={btpResults}
                  emptyMessage="No Behavioural Targets Progress results in this date range."
                />
              </>
            )}
          </CardContent>
        </Card>

        <form action={saveAction} className="space-y-6">
          <input
            type="hidden"
            name="date_range_start"
            value={selectedApproval ? derivedDateRangeStart : dateRangeStart}
          />
          <input
            type="hidden"
            name="date_range_end"
            value={selectedApproval ? derivedDateRangeEnd : dateRangeEnd}
          />
          <input
            type="hidden"
            name="appointment_ids"
            value={selectedAppointmentIds.join(",")}
          />
          <input type="hidden" name="recipient_type" value={recipientType} />
          <input type="hidden" name="funding_approval_id" value={approvalId} />
          <input type="hidden" name="report_requirement_id" value={requirementId} />

          <Card>
            <CardHeader>
              <CardTitle>Clinical summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                name="clinical_summary_text"
                value={clinicalSummary}
                onChange={(e) => setClinicalSummary(e.target.value)}
                placeholder="Enter clinical summary…"
                rows={6}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                name="recommendations_text"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Enter recommendations…"
                rows={6}
              />
            </CardContent>
          </Card>

          {saveState.error ? (
            <p className="text-sm text-destructive">{saveState.error}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={
                savePending ||
                (selectedApproval
                  ? !derivedDateRangeStart ||
                    !derivedDateRangeEnd ||
                    selectedAppointmentIds.length === 0
                  : !dateRangeStart || !dateRangeEnd)
              }
            >
              {savePending ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              disabled={!previewSnapshot}
            >
              Print / Save as PDF
            </Button>
          </div>
        </form>
      </div>

      {previewSnapshot ? (
        <div className="report-print-area hidden print:block">
          <ReportDocument snapshot={previewSnapshot} readOnly />
        </div>
      ) : null}
    </>
  )
}
