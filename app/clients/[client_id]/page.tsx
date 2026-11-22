import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { ClientSummaryPanel } from "@/app/clients/[client_id]/client-summary-menu"
import {
  ClientPanel,
  ClientPanelField,
  ClientPanelFields,
} from "@/components/clients/client-panel"
import { ClientStatusControl } from "@/components/clients/client-status-control"
import { ReferralFundingCard } from "@/components/funding/referral-funding-card"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { clients } from "@/db/schema"
import { getDefaultBatteryAssessments } from "@/lib/assessments/battery-defaults"
import { loadLatestAssessmentResultForClient } from "@/lib/assessments/load"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import {
  loadNextAppointmentForClient,
  loadAttendanceRiskForClient,
} from "@/lib/appointments/load"
import {
  loadActiveCrisisPlanSummary,
  loadEmergencyContacts,
} from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getReferralFundingCardData } from "@/lib/actions/funding"
import { buildReferralFundingCardProps } from "@/lib/funding/referral-funding-card-props"
import { formatDisplayDate } from "@/lib/funding/format"
import { appendReturnTo } from "@/lib/navigation/back"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"
import { loadClientBackground } from "@/lib/client-background/load"
import { buildBackgroundPanelSummary } from "@/lib/clients/background-summary"
import { formatCommunicationSummary } from "@/lib/clients/communication-summary"
import { buildEditDetailsHref } from "@/lib/clients/edit-details-panels"
import {
  formatCrisisPlanSummary,
  formatEmergencyContactSummary,
} from "@/lib/clients/emergency-details-summary"
import { buildReferralFundingPanelSummary } from "@/lib/clients/referral-funding-summary"
import { formatStressorsSummary } from "@/lib/clients/stressors-summary"
import { loadMedicalContactsForClient } from "@/lib/medical-contacts/load"
import {
  formatMedicalContactLabel,
  resolveMainMedicalContact,
} from "@/lib/medical-contacts/rules"
import {
  ATTENDANCE_RISK_CONFIG,
  CLIENT_STATUS_CONFIG,
  FUNDING_APPROVAL_STATUS_CONFIG,
} from "@/lib/status"
import { REPORTING_REQUIREMENT_STATUS_CONFIG } from "@/lib/funding/reporting-status"

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
    referralFundingData,
    attendanceRisk,
    latestAsq,
    latestPsf,
    background,
    medicalContacts,
  ] = await Promise.all([
    loadActiveTreatmentPlanSummary(clientId, context.practiceId),
    loadActiveCrisisPlanSummary(clientId, context.practiceId),
    getQuestionnaireEmailContext(
      context.practiceId,
      context.practitionerProfileId
    ),
    loadNextAppointmentForClient(clientId, context.practiceId),
    getReferralFundingCardData(clientId),
    loadAttendanceRiskForClient(clientId, context.practiceId),
    loadLatestAssessmentResultForClient(clientId, context.practiceId, "ASQ"),
    loadLatestAssessmentResultForClient(clientId, context.practiceId, "PSF"),
    loadClientBackground(clientId, context.practiceId),
    loadMedicalContactsForClient(clientId, context.practiceId),
  ])

  const stressorsLine = formatStressorsSummary(background?.stressors)

  const referralFunding = buildReferralFundingCardProps(
    context.practiceId,
    referralFundingData
  )

  const referralSummary = buildReferralFundingPanelSummary(
    referralFunding.approvals,
    referralFunding.formOptions.relationships,
    formatDisplayDate
  )

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
    activeTreatmentPlan?.smartGoalItems ?? []
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

  const communicationLine = formatCommunicationSummary({
    commsOptOut: client.commsOptOut,
    reminderOptOut: client.reminderOptOut,
    preSessionOptOut: client.preSessionOptOut,
    postSessionOptOut: client.postSessionOptOut,
    adminCommsOptOut: client.adminCommsOptOut,
    onlineBookingPermitted: client.onlineBookingPermitted,
  })

  const backgroundPanel = buildBackgroundPanelSummary(background)
  const mainMedicalContact = resolveMainMedicalContact(medicalContacts)
  const medicalContactLine = mainMedicalContact
    ? formatMedicalContactLabel(mainMedicalContact.professional)
    : "None recorded"
  const crisisPlanLabel = formatCrisisPlanSummary(activeCrisisPlan)

  const treatmentPlanHref = activeTreatmentPlan
    ? `/clients/${clientId}/treatment-plan/${activeTreatmentPlan.treatmentPlanId}`
    : `/clients/${clientId}/treatment-plan/new`

  const smartGoalsCount = activeTreatmentPlan?.smartGoalItems.length ?? 0

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/clients" label="← Back to clients" />
      </div>
      <EntityPageHeader
        kicker="Client details"
        name={`${client.firstName} ${client.lastName}`}
        subheading={`Date of birth: ${formatDate(client.dateOfBirth)}`}
        badge={
          <StatusBadge
            status={client.clientStatus}
            statusMap={CLIENT_STATUS_CONFIG}
          />
        }
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <ClientSummaryPanel
          clientId={clientId}
          clientEmail={clientEmail}
          practiceId={context.practiceId}
          practitionerProfileId={context.practitionerProfileId}
          templateVariables={questionnaireTemplateVariables}
          defaultAssessments={defaultBatteryAssessments}
        >
          <ClientPanelFields>
            <ClientPanelField label="Client status">
              <ClientStatusControl
                clientId={clientId}
                currentStatus={client.clientStatus}
              />
            </ClientPanelField>
            <ClientPanelField label="Next appointment">
              {nextAppointment ? (
                <Link
                  href={appendReturnTo(
                    `/appointments/${nextAppointment.appointmentId}`,
                    `/clients/${clientId}`
                  )}
                  className="text-primary hover:underline"
                >
                  {formatAppointmentDate(nextAppointment.appointmentDate)} at{" "}
                  {formatAppointmentTime(nextAppointment.appointmentTime)}
                  {nextAppointment.location?.trim()
                    ? ` — ${nextAppointment.location.trim()}`
                    : ""}
                </Link>
              ) : (
                <span className="font-normal text-muted-foreground">
                  No upcoming appointment
                </span>
              )}
            </ClientPanelField>
            <ClientPanelField label="Attendance">
              <StatusBadge
                status={attendanceRisk.tier}
                statusMap={ATTENDANCE_RISK_CONFIG}
              />
            </ClientPanelField>
            <ClientPanelField label="Notes">
              <div className="max-h-24 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm font-normal whitespace-pre-wrap">
                {client.notes?.trim() || (
                  <span className="text-muted-foreground">None recorded</span>
                )}
              </div>
            </ClientPanelField>
          </ClientPanelFields>
        </ClientSummaryPanel>

        <ClientPanel
          title="Contact details"
          control="edit"
          openHref={buildEditDetailsHref(clientId, "details")}
        >
          <ClientPanelFields>
            <ClientPanelField label="Phone">
              {client.phone?.trim() || (
                <span className="font-normal text-muted-foreground">
                  None recorded
                </span>
              )}
            </ClientPanelField>
            <ClientPanelField label="Email">
              {client.email?.trim() || (
                <span className="font-normal text-muted-foreground">
                  None recorded
                </span>
              )}
            </ClientPanelField>
            <ClientPanelField label="Address">
              {client.address?.trim() || (
                <span className="font-normal text-muted-foreground">
                  None recorded
                </span>
              )}
            </ClientPanelField>
            <ClientPanelField label="Communication">
              <Link
                href={buildEditDetailsHref(clientId, "communication")}
                className="font-normal text-primary hover:underline"
              >
                {communicationLine}
              </Link>
            </ClientPanelField>
          </ClientPanelFields>
        </ClientPanel>

        <ClientPanel
          title="Emergency details"
          control="edit"
          openHref={buildEditDetailsHref(clientId, "emergency")}
        >
          <ClientPanelFields>
            <ClientPanelField label="Emergency contact">
              <span
                className={
                  emergencyContacts.length === 0
                    ? "font-normal text-muted-foreground"
                    : undefined
                }
              >
                {formatEmergencyContactSummary(emergencyContacts)}
              </span>
            </ClientPanelField>
            <ClientPanelField label="Medical contact">
              <span
                className={
                  !mainMedicalContact
                    ? "font-normal text-muted-foreground"
                    : undefined
                }
              >
                {medicalContactLine}
              </span>
            </ClientPanelField>
            <ClientPanelField label="Crisis plan">
              {activeCrisisPlan ? (
                <Link
                  href={`/clients/${clientId}/crisis-plan/${activeCrisisPlan.crisisPlanId}`}
                  className="text-primary hover:underline"
                >
                  {crisisPlanLabel}
                </Link>
              ) : (
                <Link
                  href={`/clients/${clientId}/crisis-plan/new`}
                  className="font-normal text-primary hover:underline"
                >
                  Create crisis plan
                </Link>
              )}
            </ClientPanelField>
            <ClientPanelField label="Risk">
              {latestAsq ? (
                <span>
                  ASQ · {formatDate(latestAsq.assessmentDate)}
                  {latestAsq.score != null ? ` · ${latestAsq.score}` : ""}
                  {latestAsq.severity
                    ? ` · ${latestAsq.severity}`
                    : ""}
                </span>
              ) : (
                <span className="font-normal text-muted-foreground">
                  No ASQ on file
                </span>
              )}
            </ClientPanelField>
          </ClientPanelFields>
        </ClientPanel>

        <ClientPanel
          title="Referrals and funding"
          control="expand"
          expandedContent={
            <div className="-mx-4 -mb-2">
              <ReferralFundingCard {...referralFunding} hideTitle />
            </div>
          }
        >
          {referralSummary.approvalLine ? (
            <ClientPanelFields>
              <ClientPanelField label="Current approval">
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{referralSummary.approvalLine}</span>
                  {referralSummary.approvalStatus ? (
                    <StatusBadge
                      status={referralSummary.approvalStatus}
                      statusMap={FUNDING_APPROVAL_STATUS_CONFIG}
                    />
                  ) : null}
                </span>
              </ClientPanelField>
              {referralSummary.referrerLabel && referralSummary.referrerValue ? (
                <ClientPanelField label={referralSummary.referrerLabel}>
                  {referralSummary.referrerValue}
                </ClientPanelField>
              ) : (
                <ClientPanelField label="Referrer">
                  <span className="font-normal text-muted-foreground">
                    None recorded
                  </span>
                </ClientPanelField>
              )}
              <ClientPanelField label="Reports">
                {referralSummary.dueReports.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {referralSummary.dueReports.map((req) => (
                      <span
                        key={`${req.appointmentNumber}-${req.reportType}`}
                        className="inline-flex flex-col gap-1 rounded-md border px-2 py-1 text-xs font-normal sm:flex-row sm:items-center sm:gap-2"
                      >
                        <span>
                          {req.appointmentNumber} · {req.reportType}
                        </span>
                        <StatusBadge
                          status={req.status}
                          statusMap={REPORTING_REQUIREMENT_STATUS_CONFIG}
                        />
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="font-normal text-muted-foreground">
                    None due
                  </span>
                )}
              </ClientPanelField>
            </ClientPanelFields>
          ) : (
            <p className="text-sm text-muted-foreground">
              No funding approval yet
            </p>
          )}
        </ClientPanel>

        <ClientPanel
          title="Background and history"
          control="open"
          openHref={`/clients/${clientId}/background`}
        >
          <ClientPanelFields>
            {(
              [
                ["Relationship", backgroundPanel.relationship],
                ["Children", backgroundPanel.children],
                ["Living situation", backgroundPanel.livingSituation],
                ["Occupation", backgroundPanel.occupation],
                ["History", backgroundPanel.history],
                ["Intake interview", backgroundPanel.intakeInterview],
              ] as const
            ).map(([label, value]) => (
              <ClientPanelField key={label} label={label}>
                <span
                  className={
                    value === "Not recorded" ||
                    value === "None recorded" ||
                    value === "Not yet completed"
                      ? "font-normal text-muted-foreground"
                      : undefined
                  }
                >
                  {value}
                </span>
              </ClientPanelField>
            ))}
          </ClientPanelFields>
        </ClientPanel>

        <ClientPanel
          title="Diagnosis and treatment plan"
          control="open"
          openHref={treatmentPlanHref}
          openLabel={activeTreatmentPlan ? "Open ›" : "Create ›"}
        >
          <ClientPanelFields>
            <ClientPanelField label="Diagnosis">
              <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-3 py-2 text-sm font-normal text-muted-foreground">
                Diagnosis — coming soon
              </div>
            </ClientPanelField>
            {activeTreatmentPlan ? (
              <>
                <ClientPanelField label="Therapeutic target">
                  {activeTreatmentPlan.therapeuticTarget?.trim() || (
                    <span className="font-normal text-muted-foreground">
                      None recorded
                    </span>
                  )}
                </ClientPanelField>
                <ClientPanelField label="SMART goals">
                  {smartGoalsCount > 0 ? (
                    `${smartGoalsCount} goal${smartGoalsCount === 1 ? "" : "s"}`
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      No SMART goals set
                    </span>
                  )}
                </ClientPanelField>
              </>
            ) : (
              <ClientPanelField label="Treatment plan">
                <span className="font-normal text-muted-foreground">
                  No treatment plan
                </span>
              </ClientPanelField>
            )}
          </ClientPanelFields>
        </ClientPanel>

        {/* Progress panel is a holding area for now; full Progress design comes later. */}
        <ClientPanel
          title="Progress"
          control="open"
          openHref={`/clients/${clientId}/assessments/feedback`}
        >
          <ClientPanelFields>
            <ClientPanelField label="Feedback">
              {latestPsf ? (
                <span>
                  PSF · {formatDate(latestPsf.assessmentDate)}
                  {latestPsf.severity
                    ? ` · ${latestPsf.severity}`
                    : ""}
                </span>
              ) : (
                <span className="font-normal text-muted-foreground">
                  No PSF on file
                </span>
              )}
            </ClientPanelField>
            <ClientPanelField label="Stressors">
              <span
                className={
                  stressorsLine === "None recorded"
                    ? "font-normal text-muted-foreground"
                    : "font-normal"
                }
              >
                {stressorsLine}
              </span>
            </ClientPanelField>
          </ClientPanelFields>
          <p className="mt-3 text-xs text-muted-foreground">
            Holding area for now. The full Progress design comes later.
          </p>
        </ClientPanel>
      </div>
    </AppShell>
  )
}
