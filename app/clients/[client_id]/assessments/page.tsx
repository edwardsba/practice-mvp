import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { AssessmentsTable } from "@/app/clients/[client_id]/assessments/assessments-table"
import { AddAssessmentMenu } from "@/components/assessments/add-assessment-menu"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { clients } from "@/db/schema"
import { getDefaultBatteryAssessments } from "@/lib/assessments/battery-defaults"
import { loadAssessmentResultsForClient } from "@/lib/assessments/load-results"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"

export default async function ClientAssessmentsPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      email: clients.email,
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

  const [results, activeTreatmentPlan, emailContext] = await Promise.all([
    loadAssessmentResultsForClient(clientId, context.practiceId),
    loadActiveTreatmentPlanSummary(clientId, context.practiceId),
    getQuestionnaireEmailContext(
      context.practiceId,
      context.practitionerProfileId
    ),
  ])

  const clientName = `${client.firstName} ${client.lastName}`
  const clientEmail = client.email?.trim() || null
  const estimatedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const templateVariables = emailContext
    ? buildTemplateVariablesFromLinkResponse({
        clientFirstName: client.firstName,
        practiceName: emailContext.practiceName,
        practitionerName: emailContext.practitionerName,
        expiresAt: estimatedExpiry,
      })
    : null
  const defaultAssessments = getDefaultBatteryAssessments(
    activeTreatmentPlan?.ongoingAssessmentsJson,
    activeTreatmentPlan?.smartGoalItems ?? []
  )
  const returnTo = `/clients/${clientId}/assessments`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label={`← ${clientName}`}
        />
      </div>
      <EntityPageHeader
        kicker="Assessments"
        name={clientName}
        subheading={`${results.length} result${results.length === 1 ? "" : "s"}`}
        action={
          <AddAssessmentMenu
            clientId={clientId}
            clientEmail={clientEmail}
            practiceId={context.practiceId}
            practitionerProfileId={context.practitionerProfileId}
            templateVariables={templateVariables}
            defaultAssessments={defaultAssessments}
            returnTo={returnTo}
          />
        }
      />

      <AssessmentsTable clientId={clientId} results={results} />
    </AppShell>
  )
}
