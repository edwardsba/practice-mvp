import Link from "next/link"
import { notFound } from "next/navigation"
import { and, desc, eq } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { SendAssessmentButton } from "@/app/clients/[client_id]/send-assessment-button"
import { SendBatteryButton } from "@/app/clients/[client_id]/send-battery-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
  assessmentInstances,
  assessmentResults,
  clients,
  simpleReports,
} from "@/db/schema"
import { formatReportType } from "@/lib/reports/snapshot"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

function formatDate(value: Date | string | null) {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()

  const [client] = await db
    .select()
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

  const phq9Results = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
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
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, context.practiceId),
        eq(assessmentDefinitions.assessmentCode, "PHQ9")
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const gad7Results = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
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
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, context.practiceId),
        eq(assessmentDefinitions.assessmentCode, "GAD7")
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const asqResults = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      acuteRiskRating: assessmentResults.acuteRiskRating,
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
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, context.practiceId),
        eq(assessmentDefinitions.assessmentCode, "ASQ")
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const savedReports = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      reportType: simpleReports.reportType,
      reportStatus: simpleReports.reportStatus,
      createdAt: simpleReports.createdAt,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.clientId, clientId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .orderBy(desc(simpleReports.createdAt))

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/clients">← Back to clients</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.firstName} {client.lastName}
          </h1>
          <Button asChild>
            <Link href={`/clients/${clientId}/reports/new`}>Create Report</Link>
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Client details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="font-medium">{client.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Phone</dt>
              <dd className="font-medium">{client.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Date of birth</dt>
              <dd className="font-medium">{formatDate(client.dateOfBirth)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            Saved progress reports for this client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date created</TableHead>
                  <TableHead>Report type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedReports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No reports yet. Create a report to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  savedReports.map((report) => (
                    <TableRow key={report.simpleReportId}>
                      <TableCell>
                        <Link
                          href={`/clients/${clientId}/reports/${report.simpleReportId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {formatDate(report.createdAt)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clients/${clientId}/reports/${report.simpleReportId}`}
                          className="hover:underline"
                        >
                          {formatReportType(report.reportType)}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">
                        <Link
                          href={`/clients/${clientId}/reports/${report.simpleReportId}`}
                          className="hover:underline"
                        >
                          {report.reportStatus}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Send questionnaires</CardTitle>
          <CardDescription>
            Send the combined pre-session battery (PHQ-9 then GAD-7) or an
            individual assessment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SendBatteryButton
            clientId={clientId}
            practitionerProfileId={context.practitionerProfileId}
          />
          <div className="border-t pt-6">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Send individual assessment
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <SendAssessmentButton
                clientId={clientId}
                practitionerProfileId={context.practitionerProfileId}
                assessmentCode="PHQ9"
                buttonLabel="Send PHQ-9"
                linkHeading="PHQ-9 questionnaire link — send this to your client"
                compact
              />
              <SendAssessmentButton
                clientId={clientId}
                practitionerProfileId={context.practitionerProfileId}
                assessmentCode="GAD7"
                buttonLabel="Send GAD-7"
                linkHeading="GAD-7 questionnaire link — send this to your client"
                compact
              />
            </div>
          </div>
          <div className="border-t pt-6">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Practitioner-administered
            </p>
            <Button asChild variant="outline">
              <Link href={`/clients/${clientId}/asq/new`}>Administer ASQ</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>PHQ-9 results</CardTitle>
          <CardDescription>
            Assessment history ordered by most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phq9Results.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No PHQ-9 results recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  phq9Results.map((result) => {
                    const resultHref = `/clients/${clientId}/results/${result.assessmentResultId}`
                    return (
                      <TableRow
                        key={result.assessmentResultId}
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          <Link
                            href={resultHref}
                            className="block font-medium text-primary hover:underline"
                          >
                            {formatDate(result.assessmentDate)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={resultHref} className="block hover:underline">
                            {result.score}
                          </Link>
                        </TableCell>
                        <TableCell className="capitalize">
                          <Link href={resultHref} className="block hover:underline">
                            {result.severity}
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>ASQ results</CardTitle>
            <CardDescription>
              Ask Suicide-Screening Questions — practitioner-administered.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${clientId}/asq/new`}>Administer ASQ</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Acute Risk Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asqResults.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No ASQ results recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  asqResults.map((result) => {
                    const resultHref = `/clients/${clientId}/results/${result.assessmentResultId}`
                    return (
                      <TableRow
                        key={result.assessmentResultId}
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          <Link
                            href={resultHref}
                            className="block font-medium text-primary hover:underline"
                          >
                            {formatDate(result.assessmentDate)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={resultHref} className="block hover:underline">
                            {result.score}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={resultHref} className="block hover:underline">
                            {result.acuteRiskRating ?? "—"}
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GAD-7 results</CardTitle>
          <CardDescription>
            Assessment history ordered by most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gad7Results.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No GAD-7 results recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  gad7Results.map((result) => {
                    const resultHref = `/clients/${clientId}/results/${result.assessmentResultId}`
                    return (
                      <TableRow
                        key={result.assessmentResultId}
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          <Link
                            href={resultHref}
                            className="block font-medium text-primary hover:underline"
                          >
                            {formatDate(result.assessmentDate)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={resultHref} className="block hover:underline">
                            {result.score}
                          </Link>
                        </TableCell>
                        <TableCell className="capitalize">
                          <Link href={resultHref} className="block hover:underline">
                            {result.severity}
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
