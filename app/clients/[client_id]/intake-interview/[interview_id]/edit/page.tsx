import { notFound } from "next/navigation"

import { IntakeInterviewForm } from "@/components/intake-interview/intake-interview-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { requirePractitionerContext } from "@/lib/auth"
import {
  loadIntakeInterviewForPractice,
  verifyClientInPractice,
} from "@/lib/intake-interview/load"

export default async function EditIntakeInterviewPage({
  params,
}: {
  params: Promise<{ client_id: string; interview_id: string }>
}) {
  const { client_id: clientId, interview_id: interviewId } = await params
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) notFound()

  const interview = await loadIntakeInterviewForPractice(
    interviewId,
    clientId,
    context.practiceId
  )
  if (!interview) notFound()
  if (interview.status === "finalised") {
    notFound()
  }

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}/intake-interview/${interviewId}`}
          label="← Back to interview"
        />
      </div>
      <EntityPageHeader
        kicker="Diagnostic intake interview"
        name={clientName}
        subheading={`Edit draft v${interview.versionNumber}`}
      />
      <IntakeInterviewForm
        clientId={clientId}
        sourceInterviewId={interviewId}
        initialPayload={interview.payload}
        cancelHref={`/clients/${clientId}/intake-interview/${interviewId}`}
      />
    </AppShell>
  )
}
