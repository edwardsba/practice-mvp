import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { FeedbackOverTimeTable } from "@/app/clients/[client_id]/assessments/feedback/feedback-over-time-table"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { clients } from "@/db/schema"
import { loadPsfFeedbackForClient } from "@/lib/assessments/load-psf-feedback"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function ClientFeedbackPage({
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

  const { sessions, completedAppointments } = await loadPsfFeedbackForClient(
    clientId,
    context.practiceId
  )
  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label={`← ${clientName}`}
        />
      </div>
      <EntityPageHeader
        kicker="Feedback"
        name={clientName}
        subheading="Post-session feedback over time"
      />

      <FeedbackOverTimeTable
        clientId={clientId}
        sessions={sessions}
        completedAppointments={completedAppointments}
      />
    </AppShell>
  )
}
