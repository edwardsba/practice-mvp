import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"

import { MarkReviewedButton } from "@/app/clients/[client_id]/results/[result_id]/mark-reviewed-button"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  assessmentResults,
  clients,
} from "@/db/schema"
import {
  GAD7_IMPAIRMENT_ELEMENT_KEY,
  getFunctionalImpairmentLabelForResult,
  PHQ9_IMPAIRMENT_ELEMENT_KEY,
} from "@/lib/assessments/impairment"
import { getMaxScoreForAssessmentDefinition } from "@/lib/assessments/max-score"
import { calculatePsfScore } from "@/lib/assessments/psf"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { appendReturnTo } from "@/lib/navigation/back"
import type { SageSrCoreParsedResult } from "@/lib/sage-sr/parse-core-clinician"
import type { SageSrCoreResponseParsedResult } from "@/lib/sage-sr/parse-core-response"
import type { SageSrResolvedDiagnosis } from "@/lib/sage-sr/resolve-diagnosis-codes"

/** Shape of assessmentResults.structuredScoreJson for a SAGE_SR_CORE instance, as
 *  written by lib/sage-sr/import-sage-sr-report.ts. Either key may be absent if only
 *  one of the two companion PDFs (Clinician Report / Response Report) has been
 *  uploaded so far — the page renders whatever is present rather than assuming both. */
interface SageSrCoreStructuredData {
  clinician?: SageSrCoreParsedResult & {
    furtherEvaluationDiagnosisCodes: SageSrResolvedDiagnosis[]
    absentOrMinimalDiagnosisCodes: SageSrResolvedDiagnosis[]
  }
  response?: SageSrCoreResponseParsedResult
  footerVersion?: string | null
}

function formatDate(value: Date | string | null) {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function AssessmentResultDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string; result_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { client_id: clientId, result_id: resultId } = await params
  const { returnTo: returnToParam } = await searchParams
  const returnTo = returnToParam?.trim() || null
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    notFound()
  }

  const [result] = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
      acuteRiskRating: assessmentResults.acuteRiskRating,
      structuredScoreJson: assessmentResults.structuredScoreJson,
      assessmentDate: assessmentResults.assessmentDate,
      status: assessmentResults.status,
      assessmentName: assessmentDefinitions.assessmentName,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(
        assessmentResults.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentResults.assessmentResultId, resultId),
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!result) {
    notFound()
  }

  const isAsq = result.assessmentCode === "ASQ"
  const isPsf = result.assessmentCode === "PSF"
  const isSageSrCore = result.assessmentCode === "SAGE_SR_CORE"

  const responses = await db
    .select({
      questionText: assessmentElements.questionText,
      responseLabel: assessmentOptions.optionLabel,
      scoreValue: assessmentResponses.scoreValue,
      displayOrder: assessmentElements.displayOrder,
    })
    .from(assessmentResponses)
    .innerJoin(
      assessmentElements,
      eq(
        assessmentResponses.assessmentElementId,
        assessmentElements.assessmentElementId
      )
    )
    .innerJoin(
      assessmentOptions,
      and(
        eq(
          assessmentOptions.assessmentElementId,
          assessmentResponses.assessmentElementId
        ),
        eq(assessmentOptions.optionValue, assessmentResponses.responseValue)
      )
    )
    .where(
      and(
        eq(assessmentResponses.assessmentInstanceId, result.assessmentInstanceId),
        eq(assessmentElements.dataType, "integer")
      )
    )
    .orderBy(asc(assessmentElements.displayOrder))

  const clientName = `${client.firstName} ${client.lastName}`

  if (isSageSrCore) {
    const sageSrData = (result.structuredScoreJson ?? {}) as SageSrCoreStructuredData
    const clinician = sageSrData.clinician
    const responseItems = sageSrData.response?.responses ?? []

    return (
      <AppShell>
        <div className="mb-6">
          <BackButton
            fallbackHref={`/clients/${clientId}`}
            label="← Back to client"
          />
        </div>
        <EntityPageHeader
          kicker={result.assessmentName}
          name={clientName}
          subheading={`Completed ${formatDate(result.assessmentDate)}`}
          action={
            <MarkReviewedButton
              clientId={clientId}
              resultId={resultId}
              status={result.status}
            />
          }
        />

        {!clinician && !sageSrData.response ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No SAGE-SR data has been imported for this instance yet.
            </CardContent>
          </Card>
        ) : null}

        {clinician && clinician.alerts.length > 0 ? (
          <Card className="mb-6 border-red-200">
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {clinician.alerts.map((alert, index) => (
                <Badge key={index} variant="destructive">
                  {alert}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {clinician ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Possible diagnoses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead className="w-28">Concern</TableHead>
                      <TableHead className="w-32">ICD-10 code</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinician.highConcernDiagnoses.map((diagnosis, index) => (
                      <TableRow key={`high-${index}`}>
                        <TableCell className="whitespace-normal font-medium">
                          {diagnosis.label}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">High</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {diagnosis.icd10Code ?? (
                            <span className="text-muted-foreground">
                              Requires clinical determination
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {Object.keys(clinician.furtherEvaluationSymptomsByDiagnosis).map(
                      (label, index) => {
                        const resolved =
                          clinician.furtherEvaluationDiagnosisCodes[index]
                        return (
                          <TableRow key={`medium-${index}`}>
                            <TableCell className="whitespace-normal font-medium">
                              {label}
                            </TableCell>
                            <TableCell>
                              <Badge variant="warning">Medium</Badge>
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {resolved?.icd10Code ?? (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      }
                    )}
                    {clinician.absentOrMinimalDiagnoses.map((label, index) => {
                      const resolved = clinician.absentOrMinimalDiagnosisCodes[index]
                      return (
                        <TableRow key={`low-${index}`}>
                          <TableCell className="whitespace-normal text-muted-foreground">
                            {label}
                          </TableCell>
                          <TableCell>
                            <Badge variant="muted">Low</Badge>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {resolved?.icd10Code ?? "—"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                ICD-10 codes are provided as a starting reference only — a licensed
                clinician determines the actual diagnosis. Codes marked &ldquo;Requires
                clinical determination&rdquo; need a specifier (episode history,
                severity, or subtype) that only clinical judgment can supply.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {clinician &&
        Object.keys(clinician.endorsedSymptomsByDiagnosis).length > 0 ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Endorsed symptoms by diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(clinician.endorsedSymptomsByDiagnosis).map(
                ([diagnosis, symptoms]) => (
                  <div key={diagnosis}>
                    <p className="mb-2 font-medium">{diagnosis}</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {symptoms.map((symptom, index) => (
                        <li key={index}>{symptom}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        ) : null}

        {clinician ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Completion metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Reliability items correct
                  </dt>
                  <dd className="font-medium">
                    {clinician.metrics.reliabilityItemsCorrect ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Duration</dt>
                  <dd className="font-medium">
                    {clinician.metrics.durationMinutes !== null
                      ? `${clinician.metrics.durationMinutes} min`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Items skipped</dt>
                  <dd className="font-medium">
                    {clinician.metrics.itemsSkipped ?? "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Raw item responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">Item</TableHead>
                    <TableHead>Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responseItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="h-20 text-center text-muted-foreground"
                      >
                        No response data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    responseItems.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="whitespace-normal">
                          {row.item}
                        </TableCell>
                        <TableCell>{row.response}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  if (isPsf) {
    const psfResult = calculatePsfScore(
      responses.map((response) => response.scoreValue)
    )

    return (
      <AppShell>
        <div className="mb-6">
          <BackButton
            fallbackHref={`/clients/${clientId}/assessments`}
            label="← Back to assessments"
          />
        </div>
        <EntityPageHeader
          kicker={result.assessmentName}
          name={clientName}
          subheading={`Completed ${formatDate(result.assessmentDate)}`}
          action={
            <MarkReviewedButton
              clientId={clientId}
              resultId={resultId}
              status={result.status}
            />
          }
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Assessment details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Assessment name</dt>
                <dd className="font-medium">{result.assessmentName}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Client name</dt>
                <dd className="font-medium">{clientName}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(result.assessmentDate)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Assessment results summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">
                  Positive feedback
                </dt>
                <dd className="font-medium tabular-nums">
                  {psfResult.positiveFeedback}/10
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Negative feedback
                </dt>
                <dd className="font-medium tabular-nums">
                  {psfResult.negativeFeedback}/10
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions &amp; results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="h-20 text-center text-muted-foreground"
                      >
                        No response data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    responses.map((row) => (
                      <TableRow key={row.displayOrder}>
                        <TableCell>{row.displayOrder}</TableCell>
                        <TableCell className="whitespace-normal">
                          {row.questionText}
                        </TableCell>
                        <TableCell>{row.responseLabel}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  const maxScore = isAsq
    ? 5
    : await getMaxScoreForAssessmentDefinition(result.assessmentDefinitionId)

  let functionalImpairmentLabel: string | null = null
  if (result.assessmentCode === "PHQ9") {
    functionalImpairmentLabel = await getFunctionalImpairmentLabelForResult(
      result.assessmentInstanceId,
      PHQ9_IMPAIRMENT_ELEMENT_KEY
    )
  } else if (result.assessmentCode === "GAD7") {
    functionalImpairmentLabel = await getFunctionalImpairmentLabelForResult(
      result.assessmentInstanceId,
      GAD7_IMPAIRMENT_ELEMENT_KEY
    )
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader
        kicker={result.assessmentName}
        name={clientName}
        subheading={`Completed ${formatDate(result.assessmentDate)}`}
        action={
          <div className="flex items-center gap-3">
            {isAsq ? (
              <Link
                href={appendReturnTo(
                  `/clients/${clientId}/asq/${result.assessmentInstanceId}/edit`,
                  returnTo
                    ? `/clients/${clientId}/results/${resultId}?returnTo=${encodeURIComponent(returnTo)}`
                    : `/clients/${clientId}/results/${resultId}`
                )}
                className="text-sm font-medium text-primary hover:underline"
              >
                Edit ASQ
              </Link>
            ) : null}
            <MarkReviewedButton
              clientId={clientId}
              resultId={resultId}
              status={result.status}
            />
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total score</p>
              <p className="text-4xl font-semibold tracking-tight tabular-nums">
                {result.score}
                <span className="text-lg font-normal text-muted-foreground">
                  {" "}
                  / {maxScore}
                </span>
              </p>
            </div>
            <div className="sm:border-l sm:pl-6">
              <p className="text-sm text-muted-foreground">
                {isAsq ? "Screen outcome" : "Severity"}
              </p>
              <p className="text-xl font-medium capitalize">{result.severity}</p>
            </div>
          </div>
          {functionalImpairmentLabel ? (
            <p className="text-sm">
              <span className="font-medium text-muted-foreground">
                Functional impairment:{" "}
              </span>
              {functionalImpairmentLabel}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question responses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Question</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead className="w-20 text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No response data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  responses.map((row, index) => (
                    <TableRow key={`${row.displayOrder}-${index}`}>
                      <TableCell className="whitespace-normal">
                        {row.questionText}
                      </TableCell>
                      <TableCell>{row.responseLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.scoreValue}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
