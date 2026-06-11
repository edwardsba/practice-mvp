import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { CommunicationsPageClient } from "@/app/clients/[client_id]/communications/communications-page-client"
import { AppShell } from "@/components/app-shell"
import { clients } from "@/db/schema"
import { getDefaultBatteryAssessments } from "@/lib/assessments/battery-defaults"
import { requirePractitionerContext } from "@/lib/auth"
import { loadCommunicationsForClient } from "@/lib/communications/load"
import { db } from "@/lib/db"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"

export default async function ClientCommunicationsPage({
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

  const [communications, activeTreatmentPlan, emailContext] = await Promise.all([
    loadCommunicationsForClient(clientId, context.practiceId),
    loadActiveTreatmentPlanSummary(clientId, context.practiceId),
    getQuestionnaireEmailContext(
      context.practiceId,
      context.practitionerProfileId
    ),
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
  const clientName = `${client.firstName} ${client.lastName}`

  const serializedCommunications = communications.map((communication) => ({
    communicationId: communication.communicationId,
    sentAt: communication.sentAt.toISOString(),
    templateType: communication.templateType,
    toEmail: communication.toEmail,
    ccEmail: communication.ccEmail,
    bccEmail: communication.bccEmail,
    subject: communication.subject,
    messageText: communication.messageText,
    status: communication.status,
    errorMessage: communication.errorMessage,
  }))

  return (
    <AppShell>
      <CommunicationsPageClient
        clientId={clientId}
        clientName={clientName}
        clientEmail={clientEmail}
        practitionerProfileId={context.practitionerProfileId}
        templateVariables={questionnaireTemplateVariables}
        defaultAssessments={defaultBatteryAssessments}
        communications={serializedCommunications}
      />
    </AppShell>
  )
}
