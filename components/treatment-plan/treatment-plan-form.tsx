"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

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
  BehaviouralTargetsFields,
  MultiSelectSectionFields,
  OngoingAssessmentsFields,
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
import {
  ALTERNATE_RESPONSES_OPTIONS,
  CASE_FORMULATION_OPTIONS,
  PSYCHOEDUCATION_OPTIONS,
  QUALITY_OF_LIFE_OPTIONS,
  RISK_MANAGEMENT_OPTIONS,
  SUPPORT_SERVICES_OPTIONS,
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

export function TreatmentPlanForm({
  clientId,
  sourcePlanId,
  initialPlan,
  isNewVersion = false,
  cancelHref,
}: {
  clientId: string
  sourcePlanId: string | null
  initialPlan?: TreatmentPlanRow
  isNewVersion?: boolean
  cancelHref: string
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

  const showPreviewModal = Boolean(previewState.pdfBase64)

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
      router.push(
        `/clients/${clientId}/treatment-plan/${saveAndDownloadState.newPlanId}`
      )
    }
  }, [saveAndDownloadState, clientId, router])

  useEffect(() => {
    if (saveAndSendState.success && saveAndSendState.newPlanId) {
      router.push(
        `/clients/${clientId}/treatment-plan/${saveAndSendState.newPlanId}?openSend=1`
      )
    }
  }, [saveAndSendState, clientId, router])

  const plan = initialPlan
  const behaviouralItems = plan?.behaviouralTargetsJson?.items ?? []
  const ongoing = plan?.ongoingAssessmentsJson ?? {
    phq9: false,
    gad7: false,
    assist: false,
  }
  const emptyMulti = { selected: [], other: [] }

  return (
    <>
      <form action={previewFormAction} className="space-y-6">
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
            <CardTitle>Therapeutic targets</CardTitle>
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
              <Label>Behavioural targets</Label>
              <BehaviouralTargetsFields initialItems={behaviouralItems} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ongoing assessments</CardTitle>
          </CardHeader>
          <CardContent>
            <OngoingAssessmentsFields value={ongoing} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk management</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="risk"
              options={RISK_MANAGEMENT_OPTIONS}
              value={plan?.riskManagementJson ?? emptyMulti}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support services</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="support"
              options={SUPPORT_SERVICES_OPTIONS}
              value={plan?.supportServicesJson ?? emptyMulti}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Psychoeducation</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="psycho"
              options={PSYCHOEDUCATION_OPTIONS}
              value={plan?.psychoeducationJson ?? emptyMulti}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Case formulation</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="case"
              options={CASE_FORMULATION_OPTIONS}
              value={plan?.caseFormulationJson ?? emptyMulti}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alternate responses</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="alternate"
              options={ALTERNATE_RESPONSES_OPTIONS}
              value={plan?.alternateResponsesJson ?? emptyMulti}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality of life</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="qol"
              options={QUALITY_OF_LIFE_OPTIONS}
              value={plan?.qualityOfLifeJson ?? emptyMulti}
            />
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
          onCancel={() => router.push(cancelHref)}
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
