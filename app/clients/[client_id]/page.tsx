import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { ActionItemsSection } from "@/app/clients/[client_id]/action-items-section"
import { ClientMenuSidebar } from "@/app/clients/[client_id]/client-menu-sidebar"
import { ExportSessionNotesButton } from "@/components/session-notes/export-session-notes-button"
import { EmergencyContactsSection } from "@/components/emergency-contacts/emergency-contacts-section"
import { ClientStatusControl } from "@/components/clients/client-status-control"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { StatusBadge } from "@/components/ui/status-badge"
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
import { clients } from "@/db/schema"
import { getDefaultBatteryAssessments } from "@/lib/assessments/battery-defaults"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import { loadNextAppointmentForClient, loadAttendanceRiskForClient } from "@/lib/appointments/load"
import {
  loadActiveCrisisPlanSummary,
  loadEmergencyContacts,
} from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getFundingPanelByClientId } from "@/lib/actions/funding"
import { formatApprovalProgress, formatDisplayDate } from "@/lib/funding/format"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"
import { ATTENDANCE_RISK_CONFIG } from "@/lib/status"

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

  const [
    activeTreatmentPlan,
    activeCrisisPlan,
    emailContext,
    nextAppointment,
    fundingPanelRows,
    attendanceRisk,
  ] = await Promise.all([
    loadActiveTreatmentPlanSummary(clientId, context.practiceId),
    loadActiveCrisisPlanSummary(clientId, context.practiceId),
    getQuestionnaireEmailContext(
      context.practiceId,
      context.practitionerProfileId
    ),
    loadNextAppointmentForClient(clientId, context.practiceId),
    getFundingPanelByClientId(clientId),
    loadAttendanceRiskForClient(clientId, context.practiceId),
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
        <h1 className="text-2xl font-semibold tracking-tight">
          {client.firstName} {client.lastName}
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_200px]">
        <div>
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
                  <dd className="font-medium">
                    {formatDate(client.dateOfBirth)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Client status</dt>
                  <dd className="font-medium">
                    <ClientStatusControl
                      clientId={clientId}
                      currentStatus={client.clientStatus}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Attendance</dt>
                  <dd className="font-medium">
                    <StatusBadge
                      status={attendanceRisk.tier}
                      statusMap={ATTENDANCE_RISK_CONFIG}
                    />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">
                    Next appointment
                  </dt>
                  <dd className="font-medium">
                    {nextAppointment ? (
                      <Link
                        href={`/appointments/${nextAppointment.appointmentId}`}
                        className="text-primary hover:underline"
                      >
                        {formatAppointmentDate(nextAppointment.appointmentDate)}{" "}
                        at {formatAppointmentTime(nextAppointment.appointmentTime)}
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
            practiceId={context.practiceId}
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
                  <Link href={`/clients/${clientId}/claims`}>
                    See All
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link
                    href={`/funding/approvals/new?clientId=${clientId}&returnTo=${encodeURIComponent(`/clients/${clientId}`)}`}
                  >
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
                              <Link
                                href={approvalHref}
                                className="block hover:underline"
                              >
                                {row.approvalTypeName ?? "—"}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link
                                href={approvalHref}
                                className="block hover:underline"
                              >
                                {formatDisplayDate(row.startDate)}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link
                                href={approvalHref}
                                className="block hover:underline"
                              >
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
              <CardTitle>Records</CardTitle>
            </CardHeader>
            <CardContent>
              <ExportSessionNotesButton clientId={clientId} />
            </CardContent>
          </Card>
        </div>

        <div className="max-lg:order-last">
          <ClientMenuSidebar clientId={clientId} />
        </div>
      </div>
    </AppShell>
  )
}
