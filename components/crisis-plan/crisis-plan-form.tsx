"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  previewCrisisPlan,
  saveCrisisPlan,
  saveCrisisPlanAndDownload,
  saveCrisisPlanAndSend,
  type PreviewCrisisPlanState,
  type SaveCrisisPlanAndDownloadState,
  type SaveCrisisPlanAndSendState,
  type SaveCrisisPlanState,
} from "@/app/clients/[client_id]/crisis-plan/actions"
import {
  EmergencyContactsFormFields,
  MultiSelectSectionFields,
} from "@/components/crisis-plan/form-fields"
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
  BECOMING_UNWELL_OPTIONS,
  CRISIS_RESPONSE_OPTIONS,
  DOING_WELL_OPTIONS,
  EMERGENCY_NUMBERS_OPTIONS,
  GET_BETTER_OPTIONS,
  STAY_WELL_OPTIONS,
  UNWELL_OPTIONS,
} from "@/lib/crisis-plans/fields"
import { formatDateForInput, todayDateInput } from "@/lib/dates/practice-time"
import type {
  CrisisPlanRow,
  EmergencyContactInput,
  EmergencyContactRow,
} from "@/lib/crisis-plans/types"

const emptyMulti = { selected: [], other: [] }

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

export function CrisisPlanForm({
  clientId,
  sourcePlanId,
  initialPlan,
  initialContacts,
  cancelHref,
}: {
  clientId: string
  sourcePlanId: string | null
  initialPlan?: CrisisPlanRow
  initialContacts: EmergencyContactRow[]
  cancelHref: string
}) {
  const router = useRouter()

  const [previewState, previewFormAction, previewPending] = useActionState(
    previewCrisisPlan.bind(null, clientId, sourcePlanId),
    {} as PreviewCrisisPlanState
  )
  const [saveState, saveFormAction, savePending] = useActionState(
    saveCrisisPlan.bind(null, clientId, sourcePlanId),
    {} as SaveCrisisPlanState
  )
  const [saveAndDownloadState, saveAndDownloadFormAction, saveAndDownloadPending] =
    useActionState(
      saveCrisisPlanAndDownload.bind(null, clientId, sourcePlanId),
      {} as SaveCrisisPlanAndDownloadState
    )
  const [saveAndSendState, saveAndSendFormAction, saveAndSendPending] =
    useActionState(
      saveCrisisPlanAndSend.bind(null, clientId, sourcePlanId),
      {} as SaveCrisisPlanAndSendState
    )

  const [previewDismissed, setPreviewDismissed] = useState(false)
  const showPreviewModal = Boolean(previewState.pdfBase64) && !previewDismissed

  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContactInput[]
  >(
    initialContacts.map((contact) => ({
      contactId: contact.contactId,
      role: contact.role ?? "",
      name: contact.name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    }))
  )

  useEffect(() => {
    if (
      saveAndDownloadState.success &&
      saveAndDownloadState.pdfBase64 &&
      saveAndDownloadState.newPlanId
    ) {
      downloadBase64Pdf(
        saveAndDownloadState.pdfBase64,
        saveAndDownloadState.filename ?? "crisis-plan.pdf"
      )
      window.location.href = `/clients/${clientId}/crisis-plan/${saveAndDownloadState.newPlanId}`
    }
  }, [saveAndDownloadState, clientId])

  const plan = initialPlan

  return (
    <>
      <form
        action={previewFormAction}
        onSubmit={() => setPreviewDismissed(false)}
        className="space-y-6"
      >
        <input
          type="hidden"
          name="emergency_contacts_json"
          value={JSON.stringify(emergencyContacts)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Crisis plan details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-40 space-y-2">
              <Label htmlFor="date_of_plan">Date of plan</Label>
              <Input
                id="date_of_plan"
                name="date_of_plan"
                type="date"
                required
                className="text-sm [&::-webkit-date-and-time-value]:text-left"
                defaultValue={
                  formatDateForInput(plan?.dateOfPlan ?? null) || todayDateInput()
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emergency contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <EmergencyContactsFormFields
              initialContacts={initialContacts}
              onChange={setEmergencyContacts}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emergency numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelectSectionFields
              prefix="en"
              options={EMERGENCY_NUMBERS_OPTIONS}
              value={plan?.emergencyNumbersJson ?? emptyMulti}
              includeOther={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Doing well / Staying well</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Signs that I am doing well
              </h3>
              <MultiSelectSectionFields
                prefix="dw"
                options={DOING_WELL_OPTIONS}
                value={plan?.doingWellJson ?? emptyMulti}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Things I need to do to stay well
              </h3>
              <MultiSelectSectionFields
                prefix="sw"
                options={STAY_WELL_OPTIONS}
                value={plan?.stayWellJson ?? emptyMulti}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Becoming unwell / Getting better</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Signs that I am becoming unwell
              </h3>
              <MultiSelectSectionFields
                prefix="bu"
                options={BECOMING_UNWELL_OPTIONS}
                value={plan?.becomingUnwellJson ?? emptyMulti}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Things I need to do to get better
              </h3>
              <MultiSelectSectionFields
                prefix="gb"
                options={GET_BETTER_OPTIONS}
                value={plan?.getBetterJson ?? emptyMulti}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unwell / Crisis response</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Signs that I am unwell or in crisis
              </h3>
              <MultiSelectSectionFields
                prefix="uw"
                options={UNWELL_OPTIONS}
                value={plan?.unwellJson ?? emptyMulti}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Things to do when I am unwell — Crisis response
              </h3>
              <MultiSelectSectionFields
                prefix="cr"
                options={CRISIS_RESPONSE_OPTIONS}
                value={plan?.crisisResponseJson ?? emptyMulti}
              />
            </div>
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
          title="Review crisis plan"
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
