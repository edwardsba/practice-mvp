"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import {
  previewTreatmentPlan,
  saveTreatmentPlan,
  saveTreatmentPlanAndDownload,
  saveTreatmentPlanAndSend,
  type PreviewTreatmentPlanState,
  type SaveTreatmentPlanAndDownloadState,
  type SaveTreatmentPlanAndSendState,
  type SaveTreatmentPlanState,
} from "@/app/clients/[client_id]/treatment-plan/actions"
import {
  MedicationSupervisionFields,
  MultiSelectSectionFields,
  OngoingAssessmentsFields,
  SingleSelectSectionFields,
  SmartGoalsFields,
  SuicideAttemptsFields,
  SupportServicesFields,
} from "@/components/treatment-plan/form-fields"
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal"
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
  SUPPORT_SERVICES_OPTIONS,
  TREATMENT_MODALITY_OPTIONS,
  TREATMENT_MODEL_OPTIONS,
  TREATMENT_SUMMARY_ITEMS,
  defaultSupportServiceKeys,
} from "@/lib/treatment-plans/fields"
import { formatDateForInput, todayDateInput } from "@/lib/dates/practice-time"
import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"

function downloadBase64Pdf(pdfBase64: string, filename: string) {
  const byteCharacters = atob(pdfBase64)
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
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function CrisisPlanSummaryLine({
  clientId,
  crisisPlanSummary,
}: {
  clientId: string
  crisisPlanSummary: {
    crisisPlanId: string
    versionNumber: number
    dateOfPlan: string
  } | null
}) {
  if (!crisisPlanSummary) {
    return <p className="text-sm text-muted-foreground">No current crisis plan</p>
  }
  const date = new Date(
    crisisPlanSummary.dateOfPlan.includes("T")
      ? crisisPlanSummary.dateOfPlan
      : `${crisisPlanSummary.dateOfPlan}T00:00:00`
  )
  const dateLabel = Number.isNaN(date.getTime())
    ? crisisPlanSummary.dateOfPlan
    : date.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
  return (
    <Link
      href={`/clients/${clientId}/crisis-plan/${crisisPlanSummary.crisisPlanId}`}
      className="text-sm text-primary hover:underline"
    >
      Version {crisisPlanSummary.versionNumber} — {dateLabel}
    </Link>
  )
}

export function TreatmentPlanForm({
  clientId,
  sourcePlanId,
  initialPlan,
  isNewVersion = false,
  cancelHref,
  crisisPlanSummary = null,
}: {
  clientId: string
  sourcePlanId: string | null
  initialPlan?: TreatmentPlanRow
  isNewVersion?: boolean
  cancelHref: string
  crisisPlanSummary?: {
    crisisPlanId: string
    versionNumber: number
    dateOfPlan: string
  } | null
}) {
  const router = useRouter()

  const [previewState, previewFormAction, previewPending] = useActionState(
    previewTreatmentPlan.bind(null, clientId, sourcePlanId),
    {} as PreviewTreatmentPlanState
  )
  const [saveState, saveFormAction, savePending] = useActionState(
    saveTreatmentPlan.bind(null, clientId, sourcePlanId),
    {} as SaveTreatmentPlanState
  )
  const [saveAndDownloadState, saveAndDownloadFormAction, saveAndDownloadPending] =
    useActionState(
      saveTreatmentPlanAndDownload.bind(null, clientId, sourcePlanId),
      {} as SaveTreatmentPlanAndDownloadState
    )
  const [saveAndSendState, saveAndSendFormAction, saveAndSendPending] =
    useActionState(
      saveTreatmentPlanAndSend.bind(null, clientId, sourcePlanId),
      {} as SaveTreatmentPlanAndSendState
    )

  const [previewDismissed, setPreviewDismissed] = useState(false)

  const showPreviewModal = Boolean(previewState.pdfBase64) && !previewDismissed

  useEffect(() => {
    if (
      saveAndDownloadState.success &&
      saveAndDownloadState.pdfBase64 &&
      saveAndDownloadState.newPlanId
    ) {
      downloadBase64Pdf(
        saveAndDownloadState.pdfBase64,
        saveAndDownloadState.filename ?? "treatment-plan.pdf"
      )
      window.location.href = `/clients/${clientId}/treatment-plan/${saveAndDownloadState.newPlanId}`
    }
  }, [saveAndDownloadState, clientId])

  const plan = initialPlan
  const smartGoalItems = plan?.smartGoalsJson?.items ?? []
  const suicideAttemptItems = plan?.suicideAttemptsJson?.items ?? []
  const ongoing = plan?.ongoingAssessmentsJson ?? {
    phq9: false,
    gad7: false,
    assist: false,
  }
  const emptyMulti = { selected: [], other: [] }
  const supportServicesValue = plan?.supportServicesJson ?? {
    selected: isNewVersion || !plan ? defaultSupportServiceKeys() : [],
    other: [],
  }
  const treatmentModelValue = plan?.treatmentModelJson ?? { selected: null }
  const medicationSupervisionValue = plan?.medicationSupervisionJson ?? {
    supervised: false,
    supervisorName: null,
  }

  return (
    <>
      <form
        action={previewFormAction}
        onSubmit={() => setPreviewDismissed(false)}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Meta details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={
                  isNewVersion
                    ? todayDateInput()
                    : formatDateForInput(plan?.startDate ?? null) ||
                      todayDateInput()
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={formatDateForInput(plan?.endDate ?? null)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diagnosis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <p className="text-xs text-muted-foreground">
                Entered manually for now. Once the diagnostic assessment feature is
                built, this will be autofilled from the client&apos;s finalised
                diagnosis.
              </p>
              <Textarea
                id="diagnosis"
                name="diagnosis"
                defaultValue={plan?.diagnosis ?? ""}
                placeholder="e.g. Major Depressive Disorder, moderate, recurrent"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diagnosis_report_date">Report date</Label>
              <Input
                id="diagnosis_report_date"
                name="diagnosis_report_date"
                type="date"
                defaultValue={formatDateForInput(
                  plan?.diagnosisReportDate ?? null
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Therapeutic Target and Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="therapeutic_target">Therapeutic target</Label>
              <Input
                id="therapeutic_target"
                name="therapeutic_target"
                defaultValue={plan?.therapeuticTarget ?? ""}
                placeholder="e.g. Reduce alcohol use"
              />
            </div>
            <div className="space-y-2">
              <Label>SMART Goals</Label>
              <SmartGoalsFields initialItems={smartGoalItems} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Treatment modalities</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="modality"
              options={TREATMENT_MODALITY_OPTIONS}
              value={plan?.treatmentModalitiesJson ?? emptyMulti}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Treatment Model</CardTitle>
          </CardHeader>
          <CardContent>
            <SingleSelectSectionFields
              name="treatment_model"
              options={TREATMENT_MODEL_OPTIONS}
              value={treatmentModelValue}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ongoing assessment tools</CardTitle>
          </CardHeader>
          <CardContent>
            <OngoingAssessmentsFields value={ongoing} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Suicide attempt history (lifetime)</Label>
              <p className="text-xs text-muted-foreground">
                This is an ongoing, cumulative record. Add a new entry any time a
                new attempt occurs during treatment — do not remove prior entries
                unless correcting a data-entry error.
              </p>
              <SuicideAttemptsFields initialItems={suicideAttemptItems} />
            </div>
            <div className="space-y-2">
              <Label>Medication supervision</Label>
              <MedicationSupervisionFields value={medicationSupervisionValue} />
            </div>
            <div className="space-y-2">
              <Label>Crisis plan</Label>
              <CrisisPlanSummaryLine
                clientId={clientId}
                crisisPlanSummary={crisisPlanSummary}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other Support Services</CardTitle>
          </CardHeader>
          <CardContent>
            <SupportServicesFields
              prefix="support"
              options={SUPPORT_SERVICES_OPTIONS}
              value={supportServicesValue}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Treatment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {TREATMENT_SUMMARY_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {previewState.error ? (
          <p className="text-sm text-destructive" role="alert">
            {previewState.error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={previewPending}>
            {previewPending ? "Generating preview…" : "Finalise"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
        </div>
      </form>

      {showPreviewModal ? (
        <DocumentPreviewModal
          title="Review treatment plan"
          description="Review the PDF below before saving."
          pdfBase64={previewState.pdfBase64!}
          onCancel={() => setPreviewDismissed(true)}
          hiddenFields={{ values_json: previewState.valuesJson ?? "" }}
          saveLabel="Save"
          savePending={savePending}
          saveFormAction={saveFormAction}
          saveAndDownloadLabel="Save and download"
          saveAndDownloadPending={saveAndDownloadPending}
          saveAndDownloadFormAction={saveAndDownloadFormAction}
          saveAndSendLabel="Save and send"
          saveAndSendPending={saveAndSendPending}
          saveAndSendFormAction={saveAndSendFormAction}
        />
      ) : null}

      {saveState.error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {saveState.error}
        </p>
      ) : null}
      {saveAndDownloadState.error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {saveAndDownloadState.error}
        </p>
      ) : null}
      {saveAndSendState.error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {saveAndSendState.error}
        </p>
      ) : null}
    </>
  )
}
