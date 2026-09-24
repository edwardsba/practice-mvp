import { redirect } from "next/navigation"

import { IntakeInterviewForm } from "@/components/intake-interview/intake-interview-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { requirePractitionerContext } from "@/lib/auth"
import { todayDateInput } from "@/lib/dates/practice-time"
import { emptyPayload } from "@/lib/intake-interview/defaults"
import {
  loadCurrentIntakeInterview,
  verifyClientInPractice,
} from "@/lib/intake-interview/load"

export default async function NewIntakeInterviewPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    redirect("/clients")
  }

  const current = await loadCurrentIntakeInterview(clientId, context.practiceId)
  if (current) {
    if (current.status === "draft") {
      redirect(`/clients/${clientId}/intake-interview/${current.intakeInterviewId}/edit`)
    }
    redirect(`/clients/${clientId}/intake-interview/${current.intakeInterviewId}`)
  }

  const clientName = `${client.firstName} ${client.lastName}`
  const initialPayload = emptyPayload(todayDateInput())

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader
        kicker="Diagnostic intake interview"
        name={clientName}
        subheading="New interview"
      />
      <IntakeInterviewForm
        clientId={clientId}
        sourceInterviewId={null}
        initialPayload={initialPayload}
        cancelHref={`/clients/${clientId}`}
      />
    </AppShell>
  )
}
