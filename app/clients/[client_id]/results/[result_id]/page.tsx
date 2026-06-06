import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"

import { MarkReviewedButton } from "@/app/clients/[client_id]/results/[result_id]/mark-reviewed-button"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
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
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

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
}: {
  params: Promise<{ client_id: string; result_id: string }>
}) {
  const { client_id: clientId, result_id: resultId } = await params
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

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <h1 className="text-2xl font-semibold tracking-tight">{clientName}</h1>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            {result.assessmentName}
          </p>
          <p className="text-sm text-muted-foreground">
            Completed {formatDate(result.assessmentDate)}
          </p>
        </div>
        <MarkReviewedButton
          clientId={clientId}
          resultId={resultId}
          status={result.status}
        />
      </div>

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
            {isAsq && result.acuteRiskRating ? (
              <div className="sm:border-l sm:pl-6">
                <p className="text-sm text-muted-foreground">Acute risk rating</p>
                <p className="text-xl font-medium">{result.acuteRiskRating}</p>
              </div>
            ) : null}
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
