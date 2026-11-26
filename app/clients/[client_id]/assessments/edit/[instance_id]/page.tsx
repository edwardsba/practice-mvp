import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { PractitionerAssessmentForm } from "@/components/assessments/practitioner-assessment-form"
import { AppShell } from "@/components/app-shell"
import { clients, practitionerProfiles } from "@/db/schema"
import { loadFormDefinitionByCode } from "@/lib/assessments/load-form-definition"
import { loadAssessmentInstanceForForm } from "@/lib/assessments/load-instance-for-form"
import { instanceHasAccessLink } from "@/lib/assessments/instance-access-link"
import { canCompleteInSharedForm } from "@/lib/assessments/practitioner-routes"
import { saveEditPractitionerAssessment } from "@/lib/assessments/save-practitioner-assessment"
import { requirePractitionerContext } from "@/lib/auth"
import { todayDateInput } from "@/lib/dates/practice-time"
import { db } from "@/lib/db"
import { safeReturnTo } from "@/lib/navigation/safe-return-to"
import { formatPractitionerPreferredName } from "@/lib/practitioner/format"

export default async function EditPractitionerAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string; instance_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { client_id: clientId, instance_id: instanceId } = await params
  const query = await searchParams
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

  if (!client) notFound()

  const instance = await loadAssessmentInstanceForForm({
    instanceId,
    clientId,
    practiceId: context.practiceId,
  })
  if (!instance) notFound()

  // Link-completed instances: clients' own answers must never be edited.
  if (await instanceHasAccessLink(instanceId)) notFound()

  const definition = await loadFormDefinitionByCode(instance.assessmentCode)
  if (
    !definition ||
    !canCompleteInSharedForm({
      assessmentCode: definition.assessmentCode,
      clientCompletable: definition.clientCompletable,
      practitionerCompletable: definition.practitionerCompletable,
      isActive: definition.isActive,
      hasActiveElements: definition.elements.length > 0,
    })
  ) {
    notFound()
  }

  const [practitioner] = await db
    .select({
      firstName: practitionerProfiles.firstName,
      preferredName: practitionerProfiles.preferredName,
      lastName: practitionerProfiles.lastName,
    })
    .from(practitionerProfiles)
    .where(
      eq(
        practitionerProfiles.practitionerProfileId,
        context.practitionerProfileId
      )
    )
    .limit(1)

  const returnTo =
    safeReturnTo(query.returnTo) ?? `/clients/${clientId}/assessments`
  const clientName = `${client.firstName} ${client.lastName}`
  const practitionerName = practitioner
    ? formatPractitionerPreferredName(practitioner)
    : "Practitioner"

  const saveAction = saveEditPractitionerAssessment.bind(
    null,
    clientId,
    instanceId
  )

  return (
    <AppShell>
      <PractitionerAssessmentForm
        mode="edit"
        clientId={clientId}
        clientName={clientName}
        practitionerName={practitionerName}
        assessmentCode={instance.assessmentCode}
        displayName={definition.displayName}
        elements={definition.elements}
        initialAnswers={instance.answers}
        initialAssessmentDate={
          instance.assessmentDate || todayDateInput()
        }
        sessionNoteId={instance.sessionNoteId}
        returnTo={returnTo}
        instanceId={instanceId}
        saveAction={saveAction}
      />
    </AppShell>
  )
}
