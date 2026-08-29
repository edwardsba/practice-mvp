"use client"

import Link from "next/link"
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react"

import {
  fetchReportResultsForAppointments,
  fetchReportResultsForRange,
  type ReportPreviewRow,
} from "@/app/clients/[client_id]/reports/actions"
import {
  finaliseReportAction,
  finaliseReportAndDownloadAction,
  finaliseReportAndSendAction,
  previewReport,
  saveReportDraftAction,
  type FinaliseReportAndDownloadState,
  type FinaliseReportAndSendState,
  type FinaliseReportState,
  type PreviewReportState,
  type SaveReportDraftState,
} from "@/app/clients/[client_id]/reports/report-form-actions"
import {
  fetchSageDiagnosticReportPreview,
  saveSageDiagnosticReportDraftAction,
  type SaveSageDiagnosticReportDraftState,
} from "@/app/clients/[client_id]/reports/sage-sr-diagnostic-report-actions"
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal"
import { AssessmentSummaryMethodologyNote } from "@/components/report/assessment-summary-methodology-note"
import { ReportDocument } from "@/components/report/report-document"
import { AsqStatusBadge } from "@/components/session-notes/asq-status-badge"
import { PsqStatusBadge } from "@/components/session-notes/psq-status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { getReportTypes } from "@/lib/actions/report-types"
import type { getClientFundingApprovalsForReport } from "@/lib/actions/funding"
import {
  formatAppointmentDate,
  formatAppointmentTime,
  todayDateString,
} from "@/lib/appointments/format"
import type { SageSrDiagnosticReportContent } from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"
import type {
  SageSrDiagnosticReportInstanceOption,
  SageSrDiagnosticReportInstanceOptions,
} from "@/lib/assessment-summary/list-sage-sr-diagnostic-report-instance-options"
import type { ReportRecipient, ReportSnapshot } from "@/lib/reports/snapshot"
import type { LetterBodyDoc } from "@/lib/reports/letter-body-types"
import { parseLetterBodyJson } from "@/lib/reports/letter-body-types"
import { resolveTemplateKey } from "@/lib/reports/templates"
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
  reportTypes,
  sageSrInstanceOptions = { core: [], background: [], personality: [] },
  initialFundingApprovalId = null,
  initialRequirementId = null,
  initialReportTypeId = null,
  initialReportDate,
  initialRecipientType,
  initialSelectedAppointmentIds,
  initialDateRangeStart,
  initialDateRangeEnd,
  initialClinicalSummary,
  initialRecommendations,
  initialLetterBodyJson = null,
  initialSnapshot,
  existingDraftReportId,
  previousVersionId,
  therapeuticTarget,
  behaviouralTargets = [],
  assistEnabled = false,
  suicideAttempts = [],
  crisisPlanDate = null,
  cancelHref,
}: {
  clientId: string
  fundingApprovals: Awaited<
    ReturnType<typeof getClientFundingApprovalsForReport>
  >
  reportTypes: Awaited<ReturnType<typeof getReportTypes>>
  sageSrInstanceOptions?: SageSrDiagnosticReportInstanceOptions
  initialFundingApprovalId?: string | null
  initialRequirementId?: string | null
  initialReportTypeId?: string | null
  initialReportDate?: string
  initialRecipientType?: string
  initialSelectedAppointmentIds?: string[]
  initialDateRangeStart?: string
  initialDateRangeEnd?: string
  initialClinicalSummary?: string
  initialRecommendations?: string
  initialLetterBodyJson?: LetterBodyDoc | null
  initialSnapshot: Omit<
    ReportSnapshot,
    | "phq9Results"
    | "gad7Results"
    | "asqResults"
    | "mseResults"
    | "assistResults"
    | "btpResults"
    | "clinicalSummaryText"
    | "recommendationsText"
    | "letterBodyJson"
    | "dateRangeStart"
    | "dateRangeEnd"
    | "generatedAt"
    | "reportTitle"
    | "templateKey"
    | "reportDate"
  >
  existingDraftReportId: string | null
  previousVersionId: string | null
  therapeuticTarget?: string | null
  behaviouralTargets?: string[]
  assistEnabled?: boolean
  suicideAttempts?: ReportSnapshot["suicideAttempts"]
  crisisPlanDate?: string | null
  cancelHref: string
}) {
  const validInitialApprovalId =
    initialFundingApprovalId &&
    fundingApprovals.some(
      (fa) => fa.fundingApprovalId === initialFundingApprovalId
    )
      ? initialFundingApprovalId
      : ""

  const prePopulatedApptIdsOnce = useRef(Boolean(initialSelectedAppointmentIds?.length))
  const skipRecipientAutoOnce = useRef(initialRecipientType !== undefined)
  const skipReportTypeResetOnce = useRef(Boolean(initialReportTypeId))

  const [fundingApprovalId, setFundingApprovalId] = useState<string>(
    validInitialApprovalId
  )
  const [initialRequirementApplied, setInitialRequirementApplied] = useState(
    Boolean(initialFundingApprovalId && initialRequirementId)
  )
  const [reportTypeId, setReportTypeId] = useState<string>(
    initialReportTypeId ?? ""
  )
  const [reportTypeManuallyChanged, setReportTypeManuallyChanged] = useState(
    Boolean(initialReportTypeId)
  )
  const [reportDate, setReportDate] = useState<string>(
    initialReportDate ?? todayDateString()
  )
  const [recipientType, setRecipientType] = useState<string>(
    initialRecipientType ?? "client"
  )
  const [requirementId, setRequirementId] = useState<string>(
    validInitialApprovalId && initialRequirementId ? initialRequirementId : ""
  )
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>(
    initialSelectedAppointmentIds ?? []
  )
  const [dateRangeStart, setDateRangeStart] = useState(initialDateRangeStart ?? "")
  const [dateRangeEnd, setDateRangeEnd] = useState(initialDateRangeEnd ?? "")
  const [phq9Results, setPhq9Results] = useState<ReportPreviewRow[]>([])
  const [gad7Results, setGad7Results] = useState<ReportPreviewRow[]>([])
  const [asqResults, setAsqResults] = useState<ReportPreviewRow[]>([])
  const [mseResults, setMseResults] = useState<
    import("@/lib/reports/snapshot").MseReportResultRow[]
  >([])
  const [assistResults, setAssistResults] = useState<ReportPreviewRow[]>([])
  const [btpResults, setBtpResults] = useState<
    import("@/lib/reports/snapshot").BtpReportResultRow[]
  >([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [clinicalSummary, setClinicalSummary] = useState(
    initialClinicalSummary ?? ""
  )
  const [recommendations, setRecommendations] = useState(
    initialRecommendations ?? ""
  )
  const [letterBodyJson, setLetterBodyJson] = useState<LetterBodyDoc | null>(
    initialLetterBodyJson
  )
  const [isPendingPreview, startPreviewTransition] = useTransition()
  const [saveState, boundSaveAction, savePending] = useActionState(
    saveReportDraftAction.bind(null, clientId, existingDraftReportId, previousVersionId),
    initialSaveState
  )
  const [previewState, previewFormAction, previewPending] = useActionState(
    previewReport.bind(null, clientId, existingDraftReportId, previousVersionId),
    {} as PreviewReportState
  )
  const [finaliseState, finaliseFormAction, finalisePending] = useActionState(
    finaliseReportAction.bind(null, clientId, existingDraftReportId, previousVersionId),
    {} as FinaliseReportState
  )
  const [
    finaliseAndDownloadState,
    finaliseAndDownloadFormAction,
    finaliseAndDownloadPending,
  ] = useActionState(
    finaliseReportAndDownloadAction.bind(
      null,
      clientId,
      existingDraftReportId,
      previousVersionId
    ),
    {} as FinaliseReportAndDownloadState
  )
  const [
    finaliseAndSendState,
    finaliseAndSendFormAction,
    finaliseAndSendPending,
  ] = useActionState(
    finaliseReportAndSendAction.bind(
      null,
      clientId,
      existingDraftReportId,
      previousVersionId
    ),
    {} as FinaliseReportAndSendState
  )
  const [previewDismissed, setPreviewDismissed] = useState(false)
  const showPreviewModal = Boolean(previewState.pdfBase64) && !previewDismissed

  const selectedApproval =
    fundingApprovals.find((fa) => fa.fundingApprovalId === fundingApprovalId) ??
    null

  function findReportTypeByName(name: string) {
    const trimmed = name.trim().toLowerCase()
    return (
      reportTypes.find((rt) => rt.name.trim().toLowerCase() === trimmed) ?? null
    )
  }

  const selectedReportType =
    reportTypes.find((rt) => rt.reportTypeId === reportTypeId) ?? null
  const templateKey = resolveTemplateKey(selectedReportType?.templateKey)
  const reportTitle = selectedReportType?.name ?? "Progress Report"
  const isReferralAck = templateKey === "referral_acknowledgement"
  const isSageDiagnostic = templateKey === "sage_sr_diagnostic"

  // --- SAGE-SR Diagnostic Report composer state -------------------------------------
  // Entirely separate from the simple_reports state above (funding/appointments/letter
  // body/ReportSnapshot preview) — this report type writes to sage_sr_diagnostic_reports
  // via its own actions (sage-sr-diagnostic-report-actions.ts), per the confirmed "own
  // table, own renderer" design. Core is mandatory; Background/Personality are optional
  // and start unselected — no "always most recent" default, matching the confirmed
  // multi-round decision.
  const [sageCoreInstanceId, setSageCoreInstanceId] = useState("")
  const [sageBackgroundInstanceId, setSageBackgroundInstanceId] = useState("")
  const [sagePersonalityInstanceId, setSagePersonalityInstanceId] = useState("")
  const [sagePreviewContent, setSagePreviewContent] =
    useState<SageSrDiagnosticReportContent | null>(null)
  const [sagePreviewError, setSagePreviewError] = useState<string | null>(null)
  const [isPendingSagePreview, startSagePreviewTransition] = useTransition()
  const [sageSaveState, sageSaveFormAction, sageSavePending] = useActionState(
    saveSageDiagnosticReportDraftAction.bind(null, clientId),
    {} as SaveSageDiagnosticReportDraftState
  )

  useEffect(() => {
    // No synchronous setState branch here for "core not selected yet" (unlike
    // loadPreview's equivalent early-return below, which does clear state
    // synchronously) — the JSX below instead gates on sageCoreInstanceId directly, so
    // stale sagePreviewContent from an earlier selection is simply never rendered
    // rather than needing to be nulled out on every keystroke.
    if (!isSageDiagnostic || !sageCoreInstanceId) return
    startSagePreviewTransition(async () => {
      const { content, error } = await fetchSageDiagnosticReportPreview(clientId, {
        core: sageCoreInstanceId,
        background: sageBackgroundInstanceId || null,
        personality: sagePersonalityInstanceId || null,
      })
      setSagePreviewContent(content)
      setSagePreviewError(error ?? null)
    })
  }, [
    isSageDiagnostic,
    clientId,
    sageCoreInstanceId,
    sageBackgroundInstanceId,
    sagePersonalityInstanceId,
  ])

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
          setMseResults([])
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
          setMseResults(preview.mseResults)
          setAssistResults(preview.assistResults)
          setBtpResults(preview.btpResults)
          setPreviewError(error ?? null)
        })
      } else {
        if (!start || !end) {
          setPhq9Results([])
          setGad7Results([])
          setAsqResults([])
          setMseResults([])
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
          setMseResults(preview.mseResults)
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

  useEffect(() => {
    const approval =
      fundingApprovals.find((fa) => fa.fundingApprovalId === fundingApprovalId) ??
      null
    if (approval) {
      if (skipRecipientAutoOnce.current) {
        skipRecipientAutoOnce.current = false
      } else {
        setRecipientType("referrer")
      }

      if (prePopulatedApptIdsOnce.current) {
        prePopulatedApptIdsOnce.current = false
      } else {
        setSelectedAppointmentIds(
          approval.appointments.map((a) => a.appointmentId)
        )
      }

      if (!initialRequirementApplied) {
        const preferredReqId =
          initialRequirementId &&
          approval.requirements.some(
            (r) => r.reportRequirementId === initialRequirementId
          )
            ? initialRequirementId
            : (approval.requirements[0]?.reportRequirementId ?? "")

        setRequirementId(preferredReqId)
        if (
          initialRequirementId &&
          approval.requirements.some(
            (r) => r.reportRequirementId === initialRequirementId
          )
        ) {
          setInitialRequirementApplied(true)
        }
      } else if (initialRequirementId) {
        setRequirementId(initialRequirementId)
      }
    } else {
      setRecipientType("client")
      setSelectedAppointmentIds([])
      setRequirementId("")
    }

    if (skipReportTypeResetOnce.current) {
      skipReportTypeResetOnce.current = false
    } else {
      setReportTypeManuallyChanged(false)
    }
  }, [fundingApprovalId, fundingApprovals, initialRequirementId])

  useEffect(() => {
    if (reportTypeManuallyChanged) return
    if (!requirementId || !fundingApprovalId) return
    const approval = fundingApprovals.find(
      (fa) => fa.fundingApprovalId === fundingApprovalId
    )
    if (!approval) return
    const req = approval.requirements.find(
      (r) => r.reportRequirementId === requirementId
    )
    if (!req) return
    const matched = req.reportTypeId
      ? reportTypes.find((rt) => rt.reportTypeId === req.reportTypeId)
      : findReportTypeByName(req.reportType)
    if (matched) {
      setReportTypeId(matched.reportTypeId)
    }
  }, [
    requirementId,
    fundingApprovalId,
    reportTypeManuallyChanged,
    reportTypes,
    fundingApprovals,
  ])

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

  useEffect(() => {
    if (!selectedApproval) {
      loadPreview([], dateRangeStart, dateRangeEnd)
    }
  }, [selectedApproval, dateRangeStart, dateRangeEnd, loadPreview])

  useEffect(() => {
    if (
      finaliseAndDownloadState.success &&
      finaliseAndDownloadState.pdfBase64 &&
      finaliseAndDownloadState.newReportId
    ) {
      const byteCharacters = atob(finaliseAndDownloadState.pdfBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: "application/pdf",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = finaliseAndDownloadState.filename ?? "report.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      window.location.href = `/clients/${clientId}/reports/${finaliseAndDownloadState.newReportId}`
    }
  }, [finaliseAndDownloadState, clientId])

  const recipient: ReportRecipient =
    recipientType === "referrer" && selectedApproval
      ? {
          type: "referrer",
          name:
            [
              selectedApproval.referrerTitle,
              selectedApproval.referrerFirstName,
              selectedApproval.referrerName,
            ]
              .filter(Boolean)
              .join(" ") || null,
          title: selectedApproval.referrerTitle ?? null,
          firstName: selectedApproval.referrerFirstName ?? null,
          lastName: selectedApproval.referrerName ?? null,
          organisationName: selectedApproval.organisationName,
          streetAddress: selectedApproval.streetAddress,
          postalAddress: selectedApproval.postalAddress,
        }
      : recipientType === "client"
        ? {
            type: "client",
            name: `${initialSnapshot.client.firstName} ${initialSnapshot.client.lastName}`,
            title: null,
            firstName: null,
            lastName: null,
            organisationName: null,
            streetAddress: null,
            postalAddress: null,
          }
        : {
            type: "none",
            name: null,
            title: null,
            firstName: null,
            lastName: null,
            organisationName: null,
            streetAddress: null,
            postalAddress: null,
          }

  const letterBodyPending = !letterBodyJson

  const previewSnapshot: ReportSnapshot | null = isReferralAck
    ? fundingApprovalId
      ? {
          ...initialSnapshot,
          reportTitle,
          templateKey,
          reportDate,
          generatedAt: new Date().toISOString(),
          dateRangeStart: "",
          dateRangeEnd: "",
          phq9Results: [],
          gad7Results: [],
          asqResults: [],
          mseResults: [],
          assistResults: [],
          btpResults: [],
          clinicalSummaryText: null,
          recommendationsText: null,
          letterBodyJson,
          recipient,
          fundingApproval: null,
          selectedAppointmentIds: [],
          therapeuticTarget: therapeuticTarget ?? initialSnapshot.therapeuticTarget ?? null,
          behaviouralTargets,
          assistEnabled,
          suicideAttempts,
          crisisPlanDate,
        }
      : null
    : effectiveDateRangeStart && effectiveDateRangeEnd
      ? {
          ...initialSnapshot,
          reportTitle,
          templateKey,
          reportDate,
          generatedAt: new Date().toISOString(),
          dateRangeStart: effectiveDateRangeStart,
          dateRangeEnd: effectiveDateRangeEnd,
          phq9Results,
          gad7Results,
          asqResults,
          mseResults,
          assistResults,
          btpResults,
          clinicalSummaryText: null,
          recommendationsText: null,
          letterBodyJson,
          recipient,
          fundingApproval: null,
          selectedAppointmentIds: selectedApproval ? selectedAppointmentIds : [],
          therapeuticTarget: therapeuticTarget ?? initialSnapshot.therapeuticTarget ?? null,
          behaviouralTargets,
          assistEnabled,
          suicideAttempts,
          crisisPlanDate,
        }
      : null

  const hasPreviewSource = isReferralAck
    ? Boolean(fundingApprovalId)
    : selectedApproval
      ? selectedAppointmentIds.length > 0
      : Boolean(dateRangeStart && dateRangeEnd)

  const previewLoading = isPendingPreview && hasPreviewSource

  const hiddenFormInputs = (
    <>
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
        value={isReferralAck ? "" : selectedAppointmentIds.join(",")}
      />
      <input
        type="hidden"
        name="recipient_type"
        value={recipientType === "referrer" ? "referrer" : recipientType}
      />
      <input type="hidden" name="funding_approval_id" value={fundingApprovalId} />
      <input type="hidden" name="report_requirement_id" value={requirementId} />
      <input type="hidden" name="report_type_id" value={reportTypeId} />
      <input type="hidden" name="template_key" value={templateKey} />
      <input type="hidden" name="report_title" value={reportTitle} />
      <input type="hidden" name="report_date" value={reportDate} />
      <input type="hidden" name="clinical_summary_text" value={clinicalSummary} />
      <input type="hidden" name="recommendations_text" value={recommendations} />
      <input
        type="hidden"
        name="letter_body_json"
        value={letterBodyJson ? JSON.stringify(letterBodyJson) : ""}
      />
    </>
  )

  return (
    <>
      <div className="no-print space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Report details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSageDiagnostic ? null : (
              <div className="space-y-2">
                <Label htmlFor="funding_approval">Funding approval</Label>
                <select
                  id="funding_approval"
                  className={selectClassName}
                  value={fundingApprovalId}
                  onChange={(e) => setFundingApprovalId(e.target.value)}
                >
                  <option value="">No funding approval</option>
                  {fundingApprovals.map((fa) => (
                    <option key={fa.fundingApprovalId} value={fa.fundingApprovalId}>
                      {fa.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isSageDiagnostic &&
              selectedApproval &&
              (selectedApproval.requirements.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="report_requirement">
                    Outstanding required reporting
                  </Label>
                  <select
                    id="report_requirement"
                    className={selectClassName}
                    value={requirementId}
                    onChange={(e) => setRequirementId(e.target.value)}
                  >
                    <option value="">No specific requirement</option>
                    {selectedApproval.requirements.map((req) => (
                      <option
                        key={req.reportRequirementId}
                        value={req.reportRequirementId}
                      >
                        {req.label} — {req.reportType}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  All report requirements for this approval are fulfilled.
                </p>
              ))}

            <div className="space-y-2">
              <Label htmlFor="report_type">Report type</Label>
              <select
                id="report_type"
                className={selectClassName}
                value={reportTypeId}
                onChange={(e) => {
                  setReportTypeId(e.target.value)
                  setReportTypeManuallyChanged(true)
                }}
              >
                <option value="">Select report type</option>
                {reportTypes.map((rt) => (
                  <option key={rt.reportTypeId} value={rt.reportTypeId}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>

            {isSageDiagnostic ? null : (
              <div className="space-y-2">
                <Label htmlFor="recipient_type">Address report to</Label>
                <select
                  id="recipient_type"
                  className={selectClassName}
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value)}
                >
                  {selectedApproval && (
                    <option value="referrer">
                      Referrer ({selectedApproval.referrerName ?? "—"})
                    </option>
                  )}
                  <option value="client">Client</option>
                  <option value="none">No recipient</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="report_date">Report date</Label>
              <Input
                id="report_date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className={dateInputClassName}
              />
            </div>
          </CardContent>
        </Card>

        {isSageDiagnostic ? null : <AssessmentSummaryMethodologyNote />}

        {isSageDiagnostic ? (
          <Card>
            <CardHeader>
              <CardTitle>SAGE-SR modules to include</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <SageSrModuleInstancePicker
                label="Core (required)"
                name="sage_core_instance_id"
                options={sageSrInstanceOptions.core}
                value={sageCoreInstanceId}
                onChange={setSageCoreInstanceId}
                allowNone={false}
              />
              <SageSrModuleInstancePicker
                label="Background (optional)"
                name="sage_background_instance_id"
                options={sageSrInstanceOptions.background}
                value={sageBackgroundInstanceId}
                onChange={setSageBackgroundInstanceId}
                allowNone
              />
              <SageSrModuleInstancePicker
                label="Personality (optional)"
                name="sage_personality_instance_id"
                options={sageSrInstanceOptions.personality}
                value={sagePersonalityInstanceId}
                onChange={setSagePersonalityInstanceId}
                allowNone
              />
              {sagePreviewError ? (
                <p className="text-sm text-destructive">{sagePreviewError}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : isReferralAck ? null : (
          <>
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
                    <div data-slot="table-container" className="overflow-x-auto">
                      <div className="min-w-fit">
                        <div className="mb-1 flex items-center gap-3 border-b pb-1 text-xs font-medium text-muted-foreground">
                          <span className="w-4 shrink-0" />
                          <span className="w-32 shrink-0">Date</span>
                          <span className="w-16 shrink-0">Time</span>
                          <span className="w-20 shrink-0">Status</span>
                          <span className="w-20 shrink-0">PSQ</span>
                          <span className="w-20 shrink-0">ASQ</span>
                          <span className="w-24 shrink-0">Session note</span>
                        </div>
                        {selectedApproval.appointments.map((appt) => (
                          <label
                            key={appt.appointmentId}
                            className="flex cursor-pointer items-center gap-3 py-1 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAppointmentIds.includes(
                                appt.appointmentId
                              )}
                              onChange={(e) => {
                                setSelectedAppointmentIds((prev) =>
                                  e.target.checked
                                    ? [...prev, appt.appointmentId]
                                    : prev.filter((id) => id !== appt.appointmentId)
                                )
                              }}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="w-32 shrink-0">
                              {formatAppointmentDate(appt.appointmentDate)}
                            </span>
                            <span className="w-16 shrink-0 text-muted-foreground">
                              {formatAppointmentTime(appt.appointmentTime)}
                            </span>
                            <span className="w-20 shrink-0 capitalize text-muted-foreground">
                              {appt.status.replace("_", " ")}
                            </span>
                            <span className="w-20 shrink-0">
                              <PsqStatusBadge
                                sentAt={appt.preSessionBatterySentAt}
                                psqBatteryStatus={appt.psqBatteryStatus}
                              />
                            </span>
                            <span className="w-20 shrink-0">
                              <AsqStatusBadge asqCompleted={appt.asqCompleted} />
                            </span>
                            <span className="w-24 shrink-0 capitalize text-muted-foreground">
                              {appt.sessionNoteStatus ?? "—"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedAppointmentDates.length > 0 && (
                    <p className="pt-2 text-xs text-muted-foreground">
                      Reporting period: {derivedDateRangeStart} –{" "}
                      {derivedDateRangeEnd}
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
          </>
        )}
      </div>

      {isSageDiagnostic ? (
        <form action={sageSaveFormAction} className="mt-6 space-y-6">
          <input type="hidden" name="sage_core_instance_id" value={sageCoreInstanceId} />
          <input
            type="hidden"
            name="sage_background_instance_id"
            value={sageBackgroundInstanceId}
          />
          <input
            type="hidden"
            name="sage_personality_instance_id"
            value={sagePersonalityInstanceId}
          />
          <input type="hidden" name="report_date" value={reportDate} />

          {!sageCoreInstanceId ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Select a Core module import above to preview the report content.
              </CardContent>
            </Card>
          ) : isPendingSagePreview ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Loading preview…
              </CardContent>
            </Card>
          ) : sagePreviewContent ? (
            <div className="report-print-area space-y-6 rounded-xl border bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold">{reportTitle}</h2>
              {sagePreviewContent.introduction ? (
                <p className="text-sm">{sagePreviewContent.introduction}</p>
              ) : null}
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                {sagePreviewContent.exclusionClause}
              </div>
              {sagePreviewContent.background ? (
                <div className="space-y-2">
                  <h3 className="font-medium">Background</h3>
                  {[
                    sagePreviewContent.background.opening,
                    sagePreviewContent.background.background,
                    sagePreviewContent.background.adverseChildhoodEvents,
                    sagePreviewContent.background.currentFunctioning,
                    sagePreviewContent.background.safetyAndStability,
                    sagePreviewContent.background.treatmentEngagement,
                  ]
                    .filter((text): text is string => Boolean(text))
                    .map((text, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        {text}
                      </p>
                    ))}
                </div>
              ) : null}
              <div className="space-y-2">
                <h3 className="font-medium">Core</h3>
                {sagePreviewContent.core.alertsSentence ? (
                  <p className="text-sm font-medium text-destructive">
                    {sagePreviewContent.core.alertsSentence}
                  </p>
                ) : null}
                {sagePreviewContent.core.paragraphs.map((p) => (
                  <p key={p.diagnosis} className="text-sm text-muted-foreground">
                    {p.paragraph}
                  </p>
                ))}
                {sagePreviewContent.core.furtherEvaluationSentence ? (
                  <p className="text-sm text-muted-foreground">
                    {sagePreviewContent.core.furtherEvaluationSentence}
                  </p>
                ) : null}
                {sagePreviewContent.core.absentOrMinimalSentence ? (
                  <p className="text-sm text-muted-foreground">
                    {sagePreviewContent.core.absentOrMinimalSentence}
                  </p>
                ) : null}
              </div>
              {sagePreviewContent.personality ? (
                <div className="space-y-2">
                  <h3 className="font-medium">Personality</h3>
                  {sagePreviewContent.personality.paragraphs.map((p) => (
                    <p key={p.disorder} className="text-sm text-muted-foreground">
                      {p.paragraph}
                    </p>
                  ))}
                  {sagePreviewContent.personality.belowThresholdSentence ? (
                    <p className="text-sm text-muted-foreground">
                      {sagePreviewContent.personality.belowThresholdSentence}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                This is a plain-text content preview only — there is no formatted PDF
                for the SAGE-SR Diagnostic Report yet.
              </p>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {sagePreviewError ?? "Could not load a preview for the selected imports."}
              </CardContent>
            </Card>
          )}

          {sageSaveState.error ? (
            <p className="no-print text-sm text-destructive">{sageSaveState.error}</p>
          ) : null}

          <div className="no-print flex flex-wrap gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={sageSavePending || !reportTypeId || !sageCoreInstanceId}
            >
              {sageSavePending ? "Saving…" : "Save Draft"}
            </Button>
          </div>
        </form>
      ) : isReferralAck ? (
        <form action={boundSaveAction} className="mt-6 space-y-6">
          {hiddenFormInputs}

          {previewSnapshot ? (
            <div className="report-print-area rounded-xl border bg-white p-8 shadow-sm">
              <ReportDocument
                snapshot={previewSnapshot}
                editable
                onClinicalSummaryChange={setClinicalSummary}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Select a funding approval above to preview the letter.
              </CardContent>
            </Card>
          )}

          {saveState.error ? (
            <p className="no-print text-sm text-destructive">{saveState.error}</p>
          ) : null}
          {previewState.error ? (
            <p className="no-print text-sm text-destructive">{previewState.error}</p>
          ) : null}

          <div className="no-print flex flex-wrap gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={savePending || !reportTypeId || !fundingApprovalId}
            >
              {savePending ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="submit"
              formAction={previewFormAction}
              onClick={() => setPreviewDismissed(false)}
              disabled={previewPending || !reportTypeId || !fundingApprovalId}
            >
              {previewPending ? "Generating preview…" : "Review and Finalise"}
            </Button>
          </div>
        </form>
      ) : (
        <form action={boundSaveAction} className="mt-6 space-y-6">
          {hiddenFormInputs}

          {previewLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Loading results…
              </CardContent>
            </Card>
          ) : previewSnapshot ? (
            <div className="report-print-area rounded-xl border bg-white p-8 shadow-sm">
              <ReportDocument
                snapshot={previewSnapshot}
                editable
                letterBodyPending={letterBodyPending}
                onClinicalSummaryChange={setClinicalSummary}
                onRecommendationsChange={setRecommendations}
                onLetterBodyChange={setLetterBodyJson}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {selectedApproval
                  ? "Select at least one appointment above to preview the letter."
                  : "Select a date range above to preview the letter."}
              </CardContent>
            </Card>
          )}

          {saveState.error ? (
            <p className="no-print text-sm text-destructive">{saveState.error}</p>
          ) : null}
          {previewState.error ? (
            <p className="no-print text-sm text-destructive">{previewState.error}</p>
          ) : null}

          <div className="no-print flex flex-wrap gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={
                savePending ||
                !reportTypeId ||
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
              type="submit"
              formAction={previewFormAction}
              onClick={() => setPreviewDismissed(false)}
              disabled={
                previewPending ||
                !reportTypeId ||
                (selectedApproval
                  ? !derivedDateRangeStart ||
                    !derivedDateRangeEnd ||
                    selectedAppointmentIds.length === 0
                  : !dateRangeStart || !dateRangeEnd)
              }
            >
              {previewPending ? "Generating preview…" : "Review and Finalise"}
            </Button>
          </div>
        </form>
      )}

      {showPreviewModal ? (
        <DocumentPreviewModal
          title="Review report"
          description="Review the PDF below before finalising."
          pdfBase64={previewState.pdfBase64!}
          onCancel={() => setPreviewDismissed(true)}
          hiddenFields={{
            date_range_start: selectedApproval ? derivedDateRangeStart : dateRangeStart,
            date_range_end: selectedApproval ? derivedDateRangeEnd : dateRangeEnd,
            appointment_ids: isReferralAck ? "" : selectedAppointmentIds.join(","),
            recipient_type: recipientType === "referrer" ? "referrer" : recipientType,
            funding_approval_id: fundingApprovalId,
            report_requirement_id: requirementId,
            report_type_id: reportTypeId,
            template_key: templateKey,
            report_title: reportTitle,
            report_date: reportDate,
            letter_body_json: letterBodyJson ? JSON.stringify(letterBodyJson) : "",
            clinical_summary_text: clinicalSummary,
            recommendations_text: recommendations,
          }}
          saveLabel="Finalise"
          savePending={finalisePending}
          saveFormAction={finaliseFormAction}
          saveAndDownloadLabel="Finalise and download"
          saveAndDownloadPending={finaliseAndDownloadPending}
          saveAndDownloadFormAction={finaliseAndDownloadFormAction}
          saveAndSendLabel="Finalise and send"
          saveAndSendPending={finaliseAndSendPending}
          saveAndSendFormAction={finaliseAndSendFormAction}
        />
      ) : null}
      {finaliseState.error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {finaliseState.error}
        </p>
      ) : null}
      {finaliseAndDownloadState.error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {finaliseAndDownloadState.error}
        </p>
      ) : null}
      {finaliseAndSendState.error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {finaliseAndSendState.error}
        </p>
      ) : null}
    </>
  )
}

/**
 * A single module's row of import-round options in the SAGE-SR Diagnostic Report
 * composer — a plain radio group (not checkboxes, despite selectedInstancesJson's
 * design being described as "mirroring the appointment checkbox pattern"): each module
 * resolves to exactly one instanceId in the stored shape
 * (SageSrDiagnosticReportSelectedInstances), so the UI has to enforce a single
 * selection per module even though the underlying idea — surface every real import
 * round and let the practitioner choose, never silently default to "most recent" — is
 * the same one that pattern established. An option whose import is missing the data
 * this module's generator needs (e.g. Personality's interpreted report without its
 * Response Report companion) is still listed, so a half-imported round isn't just
 * invisible, but disabled — selecting it would only produce a server-side error from
 * loadSageSrDiagnosticReportContentForClient.
 */
function SageSrModuleInstancePicker({
  label,
  name,
  options,
  value,
  onChange,
  allowNone,
}: {
  label: string
  name: string
  options: SageSrDiagnosticReportInstanceOption[]
  value: string
  onChange: (value: string) => void
  allowNone: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No imports on file for this module.
        </p>
      ) : (
        <div className="space-y-1">
          {allowNone ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                checked={value === ""}
                onChange={() => onChange("")}
                className="h-4 w-4"
              />
              <span className="text-muted-foreground">None</span>
            </label>
          ) : null}
          {options.map((option) => (
            <label
              key={option.assessmentInstanceId}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={name}
                checked={value === option.assessmentInstanceId}
                disabled={!option.hasRequiredData}
                onChange={() => onChange(option.assessmentInstanceId)}
                className="h-4 w-4"
              />
              <span>{formatAppointmentDate(option.evaluationDate)}</span>
              {!option.hasRequiredData ? (
                <span className="text-xs text-muted-foreground">
                  (incomplete import — missing required data)
                </span>
              ) : null}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
