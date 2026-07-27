import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { updateAsqResult } from "@/app/clients/[client_id]/asq/new/actions"
import { AsqForm } from "@/app/clients/[client_id]/asq/new/asq-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResponses,
  clients,
} from "@/db/schema"
import { loadAsqQuestionnaire } from "@/lib/assessments/load-asq"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function EditAsqPage({
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
        eq(assessmentDefinitions.assessmentCode, "ASQ")
      )
    )
    .limit(1)

  if (!instance) {
    notFound()
  }

  const questions = await loadAsqQuestionnaire()
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
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader kicker="ASQ" name={clientName} subheading="Edit ASQ" />

      <Card>
        <CardHeader>
          <CardTitle>Ask Suicide-Screening Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <AsqForm
            clientId={clientId}
            clientName={clientName}
            questions={questions}
            returnTo={returnTo}
            existingResponses={existingResponses}
            action={updateAsqResult.bind(null, clientId, instanceId)}
            submitLabel="Save changes"
            warningMessage="Editing this ASQ will overwrite the previously recorded responses and re-score the result. The original responses will not be retained — only that an edit was made will be logged."
          />
        </CardContent>
      </Card>
    </AppShell>
  )
}
