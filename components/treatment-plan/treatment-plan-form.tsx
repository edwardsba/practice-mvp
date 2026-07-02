"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  BehaviouralTargetsFields,
  MultiSelectSectionFields,
  OngoingAssessmentsFields,
} from "@/components/treatment-plan/form-fields"
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
import { formatDateForInput } from "@/lib/dates/practice-time"
import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"

export type TreatmentPlanFormState = {
  error?: string
}

export function TreatmentPlanForm({
  action,
  initialPlan,
  submitLabel,
  cancelHref,
}: {
  action: (
    prevState: TreatmentPlanFormState,
    formData: FormData
  ) => Promise<TreatmentPlanFormState>
  initialPlan?: TreatmentPlanRow
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(
    action,
    {} as TreatmentPlanFormState
  )

  const plan = initialPlan
  const behaviouralItems = plan?.behaviouralTargetsJson?.items ?? []
  const ongoing = plan?.ongoingAssessmentsJson ?? {
    phq9: false,
    gad7: false,
    assist: false,
  }
  const emptyMulti = { selected: [], other: [] }

  return (
    <form action={formAction} className="space-y-6">
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
              defaultValue={formatDateForInput(plan?.startDate ?? null)}
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

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
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
