import Link from "next/link"
import { notFound } from "next/navigation"
import { and, desc, eq } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { SendAssessmentButton } from "@/app/clients/[client_id]/send-assessment-button"
import { SendBatteryButton } from "@/app/clients/[client_id]/send-battery-button"
import { ActionItemsSection } from "@/app/clients/[client_id]/action-items-section"
import { EmergencyContactsSection } from "@/components/emergency-contacts/emergency-contacts-section"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
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
  assessmentInstances,
  assessmentResults,
  clients,
  simpleReports,
} from "@/db/schema"
import { formatReportType } from "@/lib/reports/snapshot"
import {
  loadActiveCrisisPlanSummary,
  loadEmergencyContacts,
} from "@/lib/crisis-plans/load"
import { getDefaultBatteryAssessments } from "@/lib/assessments/battery-defaults"
import { loadLatestBtpResultForClient } from "@/lib/assessments/btp-results"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import { loadNextAppointmentForClient } from "@/lib/appointments/load"
import {
  formatSessionNoteDate,
  formatSessionNoteStatus,
} from "@/lib/session-notes/format"
import { loadLatestSessionNoteForClient } from "@/lib/session-notes/load"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getFundingPanelByClientId } from "@/lib/actions/funding"
import { formatApprovalProgress, formatDisplayDate } from "@/lib/funding/format"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"

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

  const assistResults = await db
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
        eq(assessmentDefinitions.assessmentCode, "ASSIST")
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

  const [
    activeTreatmentPlan,
    activeCrisisPlan,
    emailContext,
    nextAppointment,
    latestBtpResult,
    latestSessionNote,
    fundingPanelRows,
  ] = await Promise.all([
    loadActiveTreatmentPlanSummary(clientId, context.practiceId),
    loadActiveCrisisPlanSummary(clientId, context.practiceId),
    getQuestionnaireEmailContext(
      context.practiceId,
      context.practitionerProfileId
    ),
    loadNextAppointmentForClient(clientId, context.practiceId),
    loadLatestBtpResultForClient(clientId, context.practiceId),
    loadLatestSessionNoteForClient(clientId, context.practiceId),
    getFundingPanelByClientId(clientId),
  ])

  const clientEmail = client.email?.trim() || null
  const estimatedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const questionnaireTemplateVariables = emailContext
    ? buildTemplateVariablesFromLinkResponse({
        clientFirstName: client.firstName,
        practiceName: emailContext.practiceName,
        practitionerName: emailContext.practitionerName,
        expiresAt: estimatedExpiry,
      })
    : null

  const defaultBatteryAssessments = getDefaultBatteryAssessments(
    activeTreatmentPlan?.ongoingAssessmentsJson,
    activeTreatmentPlan?.behaviouralTargetItems ?? []
  )

  let emergencyContacts: Awaited<ReturnType<typeof loadEmergencyContacts>> = []
  try {
    emergencyContacts = await loadEmergencyContacts(
      clientId,
      context.practiceId
    )
  } catch {
    emergencyContacts = []
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/clients" label="← Back to clients" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.firstName} {client.lastName}
          </h1>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Client details</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clients/${clientId}/edit`}>Edit Client</Link>
          </Button>
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
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Next appointment</dt>
              <dd className="font-medium">
                {nextAppointment ? (
                  <Link
                    href={`/appointments/${nextAppointment.appointmentId}`}
                    className="text-primary hover:underline"
                  >
                    {formatAppointmentDate(nextAppointment.appointmentDate)} at{" "}
                    {formatAppointmentTime(nextAppointment.appointmentTime)}
                    {nextAppointment.location?.trim()
                      ? ` — ${nextAppointment.location.trim()}`
                      : ""}
                  </Link>
                ) : (
                  "No upcoming appointment"
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <ActionItemsSection
        clientId={clientId}
        clientEmail={clientEmail}
        practitionerProfileId={context.practitionerProfileId}
        templateVariables={questionnaireTemplateVariables}
        defaultAssessments={defaultBatteryAssessments}
      />

      <Card className="mb-6">
        <EmergencyContactsSection
          clientId={clientId}
          contacts={emergencyContacts}
        />
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Funding</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/funding/claims?clientId=${clientId}`}>
                See All
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/funding/approvals/new?clientId=${clientId}`}>
                Add Approval
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundingPanelRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No funding approvals yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  fundingPanelRows.map((row) => {
                    const approvalHref = `/funding/approvals/${row.fundingApprovalId}`
                    return (
                      <TableRow
                        key={row.fundingApprovalId}
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          <Link
                            href={approvalHref}
                            className="block text-primary hover:underline"
                          >
                            {row.claimTypeName ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={approvalHref} className="block hover:underline">
                            {row.approvalTypeName ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={approvalHref} className="block hover:underline">
                            {formatDisplayDate(row.startDate)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={approvalHref} className="block hover:underline">
                            {formatApprovalProgress(
                              row.appointmentsAttended,
                              row.appointmentsApproved
                            )}
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Treatment plan</CardTitle>
          {!activeTreatmentPlan ? (
            <Button asChild size="sm">
              <Link href={`/clients/${clientId}/treatment-plan/new`}>
                Create treatment plan
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/clients/${clientId}/treatment-plan/${activeTreatmentPlan.treatmentPlanId}`}
              >
                View / Edit
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeTreatmentPlan ? (
            <p className="text-sm text-muted-foreground">No treatment plan</p>
          ) : (
            <dl className="grid gap-3">
              <div>
                <dt className="text-sm text-muted-foreground">
                  Therapeutic target
                </dt>
                <dd className="font-medium">
                  {activeTreatmentPlan.therapeuticTarget?.trim() || "—"}
                </dd>
              </div>
            </dl>
          )}

          {activeTreatmentPlan ? (
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Behavioural targets</p>
              {activeTreatmentPlan.behaviouralTargetItems.length > 0 ? (
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {activeTreatmentPlan.behaviouralTargetItems.map(
                    (target, index) => (
                      <li key={`${index}-${target}`}>{target}</li>
                    )
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No behavioural targets set
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Crisis plan</CardTitle>
          {!activeCrisisPlan ? (
            <Button asChild size="sm">
              <Link href={`/clients/${clientId}/crisis-plan/new`}>
                Create crisis plan
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/clients/${clientId}/crisis-plan/${activeCrisisPlan.crisisPlanId}`}
              >
                View / Edit
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!activeCrisisPlan ? (
            <p className="text-sm text-muted-foreground">No crisis plan</p>
          ) : (
            <dl className="grid gap-3">
              <div>
                <dt className="text-sm text-muted-foreground">Date of plan</dt>
                <dd className="font-medium">
                  {formatDate(activeCrisisPlan.dateOfPlan)}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Send questionnaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {questionnaireTemplateVariables ? (
            <>
              <SendBatteryButton
                clientId={clientId}
                practitionerProfileId={context.practitionerProfileId}
                clientEmail={clientEmail}
                templateVariables={questionnaireTemplateVariables}
                defaultAssessments={defaultBatteryAssessments}
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
                    clientEmail={clientEmail}
                    templateVariables={questionnaireTemplateVariables}
                    compact
                  />
                  <SendAssessmentButton
                    clientId={clientId}
                    practitionerProfileId={context.practitionerProfileId}
                    assessmentCode="GAD7"
                    buttonLabel="Send GAD-7"
                    clientEmail={clientEmail}
                    templateVariables={questionnaireTemplateVariables}
                    compact
                  />
                  <SendAssessmentButton
                    clientId={clientId}
                    practitionerProfileId={context.practitionerProfileId}
                    assessmentCode="ASSIST"
                    buttonLabel="Send ASSIST"
                    clientEmail={clientEmail}
                    templateVariables={questionnaireTemplateVariables}
                    compact
                  />
                </div>
              </div>
            </>
          ) : null}
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
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Session Notes</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/session-notes?client_id=${clientId}`}>
                View all
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/session-notes/new?client_id=${clientId}`}>
                New Session Note
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!latestSessionNote ? (
            <p className="text-sm text-muted-foreground">
              No session notes yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {formatSessionNoteDate(latestSessionNote.sessionDate)}
                </p>
                <p className="text-muted-foreground">
                  {formatSessionNoteStatus(latestSessionNote.status)}
                </p>
              </div>
              <Link
                href={`/session-notes/${latestSessionNote.sessionNoteId}`}
                className="text-primary hover:underline"
              >
                View session note
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reports</CardTitle>
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
          <CardTitle>Behavioural Targets Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {!latestBtpResult ? (
            <p className="text-sm text-muted-foreground">
              No BTP results recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Most recent: {formatDate(latestBtpResult.assessmentDate)}
              </p>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestBtpResult.targets.map((target) => (
                      <TableRow key={target.target}>
                        <TableCell>{target.target}</TableCell>
                        <TableCell>{target.score}</TableCell>
                        <TableCell>{target.ratingLabel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>PHQ-9 results</CardTitle>
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
        <CardHeader>
          <CardTitle>GAD-7 results</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>ASSIST results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assistResults.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No ASSIST results recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  assistResults.map((result) => {
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ASQ results</CardTitle>
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
    </AppShell>
  )
}
