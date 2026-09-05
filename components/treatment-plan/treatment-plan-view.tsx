import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ALTERNATE_RESPONSES_OPTIONS,
  CASE_FORMULATION_OPTIONS,
  ONGOING_ASSESSMENT_OPTIONS,
  PSYCHOEDUCATION_OPTIONS,
  QUALITY_OF_LIFE_OPTIONS,
  RISK_MANAGEMENT_OPTIONS,
  SUPPORT_SERVICES_OPTIONS,
  TREATMENT_MODALITY_OPTIONS,
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

export function TreatmentPlanView({ plan }: { plan: TreatmentPlanRow }) {
  const ongoing = plan.ongoingAssessmentsJson ?? {
    phq9: false,
    gad7: false,
    assist: false,
  }
  const ongoingLabels = ONGOING_ASSESSMENT_OPTIONS.filter(
    (option) => ongoing[option.key as keyof typeof ongoing]
  ).map((option) => option.label)

  const behaviouralItems = plan.behaviouralTargetsJson?.items ?? []
  const suicideAttempts = sortAttemptsChronologically(
    plan.suicideAttemptsJson?.items ?? []
  )
  const emptyMulti = { selected: [], other: [] }

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
        <CardContent>
          <p className="whitespace-pre-wrap text-sm font-medium">
            {plan.diagnosis?.trim() || "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Treatment targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Therapeutic target</p>
            <p className="mt-1 font-medium">
              {plan.therapeuticTarget?.trim() || "—"}
            </p>
          </div>
          <div id="behavioural-targets" className="scroll-mt-24">
            <p className="text-sm text-muted-foreground">Behavioural targets</p>
            <div className="mt-2">
              <ViewList items={behaviouralItems} />
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
          <CardTitle>Case formulation model</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewMultiSection
            options={CASE_FORMULATION_OPTIONS}
            section={plan.caseFormulationJson ?? emptyMulti}
          />
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
          <ViewMultiSection
            options={RISK_MANAGEMENT_OPTIONS}
            section={plan.riskManagementJson ?? emptyMulti}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support services</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewMultiSection
            options={SUPPORT_SERVICES_OPTIONS}
            section={plan.supportServicesJson ?? emptyMulti}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Psychoeducation</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewMultiSection
            options={PSYCHOEDUCATION_OPTIONS}
            section={plan.psychoeducationJson ?? emptyMulti}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alternate responses</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewMultiSection
            options={ALTERNATE_RESPONSES_OPTIONS}
            section={plan.alternateResponsesJson ?? emptyMulti}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality of life</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewMultiSection
            options={QUALITY_OF_LIFE_OPTIONS}
            section={plan.qualityOfLifeJson ?? emptyMulti}
          />
        </CardContent>
      </Card>
    </div>
  )
}
