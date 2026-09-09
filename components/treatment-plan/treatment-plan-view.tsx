import Link from "next/link"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ONGOING_ASSESSMENT_OPTIONS,
  SUPPORT_SERVICES_OPTIONS,
  TREATMENT_MODALITY_OPTIONS,
  TREATMENT_MODEL_OPTIONS,
  TREATMENT_SUMMARY_ITEMS,
  optionLabel,
} from "@/lib/treatment-plans/fields"
import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import {
  formatAttemptDate,
  sortAttemptsChronologically,
} from "@/lib/treatment-plans/format-attempt-date"

function formatDisplayDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function ViewList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None selected</p>
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function ViewMultiSection({
  options,
  section,
}: {
  options: { key: string; label: string }[]
  section: { selected: string[]; other: string[] }
}) {
  const labels = [
    ...section.selected.map((key) => optionLabel(options, key)),
    ...section.other,
  ]
  return <ViewList items={labels} />
}

export function TreatmentPlanView({
  plan,
  clientId,
  crisisPlanSummary = null,
}: {
  plan: TreatmentPlanRow
  clientId: string
  crisisPlanSummary?: {
    crisisPlanId: string
    versionNumber: number
    dateOfPlan: string
  } | null
}) {
  const ongoing = plan.ongoingAssessmentsJson ?? {
    phq9: false,
    gad7: false,
    assist: false,
  }
  const ongoingLabels = ONGOING_ASSESSMENT_OPTIONS.filter(
    (option) => ongoing[option.key as keyof typeof ongoing]
  ).map((option) => option.label)

  const smartGoalItems = plan.smartGoalsJson?.items ?? []
  const suicideAttempts = sortAttemptsChronologically(
    plan.suicideAttemptsJson?.items ?? []
  )
  const emptyMulti = { selected: [], other: [] }
  const supportServicesSection = plan.supportServicesJson ?? emptyMulti
  const medicationSupervision = plan.medicationSupervisionJson ?? {
    supervised: false,
    supervisorName: null,
  }
  const treatmentModelLabel = plan.treatmentModelJson?.selected
    ? optionLabel(TREATMENT_MODEL_OPTIONS, plan.treatmentModelJson.selected)
    : null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Meta details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Start date</dt>
              <dd className="font-medium">{formatDisplayDate(plan.startDate)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">End date</dt>
              <dd className="font-medium">{formatDisplayDate(plan.endDate)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnosis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm font-medium">
            {plan.diagnosis?.trim() || "—"}
          </p>
          <div>
            <p className="text-sm text-muted-foreground">Report date</p>
            <p className="mt-1 font-medium">
              {formatDisplayDate(plan.diagnosisReportDate)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Therapeutic Target and Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Therapeutic target</p>
            <p className="mt-1 font-medium">
              {plan.therapeuticTarget?.trim() || "—"}
            </p>
          </div>
          <div id="smart-goals" className="scroll-mt-24">
            <p className="text-sm text-muted-foreground">SMART Goals</p>
            <div className="mt-2">
              <ViewList items={smartGoalItems} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Treatment modalities</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewMultiSection
            options={TREATMENT_MODALITY_OPTIONS}
            section={plan.treatmentModalitiesJson ?? emptyMulti}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Treatment Model</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{treatmentModelLabel ?? "None selected"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ongoing assessment tools</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewList items={ongoingLabels} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Suicide attempt history (lifetime)
            </p>
            {suicideAttempts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No suicide attempts recorded
              </p>
            ) : (
              <ul className="mt-2 list-inside list-disc space-y-2 text-sm">
                {suicideAttempts.map((attempt) => (
                  <li key={attempt.id}>
                    <span className="font-medium">
                      {formatAttemptDate(attempt)}
                    </span>
                    {attempt.notes ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {attempt.notes}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Medication supervision</p>
            <p className="mt-1 text-sm">
              {medicationSupervision.supervised
                ? `Yes — supervised by ${medicationSupervision.supervisorName ?? "—"}`
                : "No"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Crisis plan</p>
            <div className="mt-1">
              {crisisPlanSummary ? (
                <Link
                  href={`/clients/${clientId}/crisis-plan/${crisisPlanSummary.crisisPlanId}`}
                  className="text-sm text-primary hover:underline"
                >
                  Version {crisisPlanSummary.versionNumber} —{" "}
                  {formatDisplayDate(crisisPlanSummary.dateOfPlan)}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No current crisis plan
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other Support Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SUPPORT_SERVICES_OPTIONS.filter((option) =>
            supportServicesSection.selected.includes(option.key)
          ).map((option) => (
            <div key={option.key}>
              <p className="text-sm font-medium">{option.label}</p>
              {option.children ? (
                <ul className="ml-4 mt-1 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {option.children
                    .filter((child) =>
                      supportServicesSection.selected.includes(child.key)
                    )
                    .map((child) => (
                      <li key={child.key}>{child.label}</li>
                    ))}
                </ul>
              ) : null}
            </div>
          ))}
          {SUPPORT_SERVICES_OPTIONS.every(
            (option) => !supportServicesSection.selected.includes(option.key)
          ) && supportServicesSection.other.length === 0 ? (
            <p className="text-sm text-muted-foreground">None selected</p>
          ) : null}
          {supportServicesSection.other.length > 0 ? (
            <ViewList items={supportServicesSection.other} />
          ) : null}
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
    </div>
  )
}
