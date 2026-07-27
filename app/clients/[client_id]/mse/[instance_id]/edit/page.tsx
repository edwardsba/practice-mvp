import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { updateMseResult } from "@/app/clients/[client_id]/mse/new/actions"
import { MseForm } from "@/app/clients/[client_id]/mse/new/mse-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResponses,
  clients,
} from "@/db/schema"
import { loadMseQuestionnaire } from "@/lib/assessments/load-mse"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function EditMsePage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string; instance_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { client_id: clientId, instance_id: instanceId } = await params
  const { returnTo: returnToParam } = await searchParams
  const returnTo = returnToParam?.trim() || null
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

  const [instance] = await db
    .select({ assessmentInstanceId: assessmentInstances.assessmentInstanceId })
    .from(assessmentInstances)
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentInstances.assessmentInstanceId, instanceId),
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentInstances.practiceId, context.practiceId),
        eq(assessmentDefinitions.assessmentCode, "mse")
      )
    )
    .limit(1)

  if (!instance) {
    notFound()
  }

  const questions = await loadMseQuestionnaire()
  if (!questions?.length) {
    notFound()
  }

  const responseRows = await db
    .select({
      elementId: assessmentResponses.assessmentElementId,
      responseValue: assessmentResponses.responseValue,
    })
    .from(assessmentResponses)
    .where(eq(assessmentResponses.assessmentInstanceId, instanceId))

  const existingResponses = Object.fromEntries(
    responseRows.map((row) => [row.elementId, row.responseValue])
  )

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}/mse/${instanceId}`}
          label="← Back to MSE"
        />
      </div>
      <EntityPageHeader kicker="MSE" name={clientName} subheading="Edit MSE" />

      <MseForm
        clientId={clientId}
        clientName={clientName}
        questions={questions}
        returnTo={returnTo}
        existingResponses={existingResponses}
        action={updateMseResult.bind(null, clientId, instanceId)}
        submitLabel="Save changes"
        warningMessage="Editing this MSE will overwrite the previously recorded responses. The original responses will not be retained — only that an edit was made will be logged."
      />
    </AppShell>
  )
}
