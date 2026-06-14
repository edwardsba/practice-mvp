import { Fragment } from "react"
import { notFound } from "next/navigation"

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
import { getAssessmentDefinitionByCode } from "@/lib/actions/assessment-definitions"
import { requirePractitionerContext } from "@/lib/auth"

function formatYesNo(value: boolean) {
  return value ? "Yes" : "No"
}

function formatStatus(isActive: boolean) {
  return isActive ? "Active" : "Inactive"
}

function formatOptions(
  options: Array<{
    optionLabel: string
    scoreValue: number
  }>
) {
  if (options.length === 0) return "—"

  return options
    .map((option) => `${option.optionLabel} (${option.scoreValue})`)
    .join(" · ")
}

export default async function AssessmentDefinitionDetailPage({
  params,
}: {
  params: Promise<{ assessment_code: string }>
}) {
  const { assessment_code: assessmentCodeParam } = await params
  await requirePractitionerContext()

  const assessmentCode = decodeURIComponent(assessmentCodeParam)
  const definition = await getAssessmentDefinitionByCode(assessmentCode)

  if (!definition) {
    notFound()
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/settings/assessments"
          label="← Back to assessments"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          {definition.assessmentName}
        </h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Assessment name</dt>
              <dd className="font-medium">{definition.assessmentName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Assessment code</dt>
              <dd className="font-medium">{definition.assessmentCode}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Type</dt>
              <dd className="font-medium">{definition.assessmentType}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium">
                {formatStatus(definition.isActive)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Scoring enabled</dt>
              <dd className="font-medium">
                {formatYesNo(definition.scoringEnabled)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Client completable
              </dt>
              <dd className="font-medium">
                {formatYesNo(definition.clientCompletable)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Practitioner completable
              </dt>
              <dd className="font-medium">
                {formatYesNo(definition.practitionerCompletable)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Description</dt>
              <dd className="font-medium">
                {definition.description?.trim() ? definition.description : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definition.elements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No questions configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  definition.elements.map((element) => (
                    <Fragment key={element.assessmentElementId}>
                      <TableRow>
                        <TableCell>{element.displayOrder}</TableCell>
                        <TableCell>{element.questionText}</TableCell>
                        <TableCell>{element.elementType}</TableCell>
                        <TableCell>{formatYesNo(element.isRequired)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="border-t-0 pt-0 text-sm text-muted-foreground"
                        >
                          {formatOptions(element.options)}
                        </TableCell>
                      </TableRow>
                    </Fragment>
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
