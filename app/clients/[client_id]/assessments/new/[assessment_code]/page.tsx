import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { PractitionerAssessmentForm } from "@/components/assessments/practitioner-assessment-form"
import { AppShell } from "@/components/app-shell"
import { clients, practitionerProfiles } from "@/db/schema"
import { defaultAnswersFromElements } from "@/lib/assessments/form-rules"
import { loadFormDefinitionByCode } from "@/lib/assessments/load-form-definition"
import { canCompleteInSharedForm } from "@/lib/assessments/practitioner-routes"
import { saveNewPractitionerAssessment } from "@/lib/assessments/save-practitioner-assessment"
import { requirePractitionerContext } from "@/lib/auth"
import { todayDateInput } from "@/lib/dates/practice-time"
import { db } from "@/lib/db"
import { safeReturnTo } from "@/lib/navigation/safe-return-to"
import { formatPractitionerPreferredName } from "@/lib/practitioner/format"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

export default async function NewPractitionerAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string; assessment_code: string }>
  searchParams: Promise<{ session_note_id?: string; returnTo?: string }>
}) {
  const { client_id: clientId, assessment_code: assessmentCodeParam } =
    await params
  const query = await searchParams
  const assessmentCode = decodeURIComponent(assessmentCodeParam)
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

  const definition = await loadFormDefinitionByCode(assessmentCode)
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

  const sessionNoteId = query.session_note_id?.trim() || null
  if (sessionNoteId) {
    const note = await loadSessionNoteForPractice(
      sessionNoteId,
      context.practiceId
    )
    if (!note || note.clientId !== clientId) notFound()
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

  const saveAction = saveNewPractitionerAssessment.bind(
    null,
    clientId,
    assessmentCode
  )

  return (
    <AppShell>
      <PractitionerAssessmentForm
        mode="new"
        clientId={clientId}
        clientName={clientName}
        practitionerName={practitionerName}
        assessmentCode={assessmentCode}
        displayName={definition.displayName}
        elements={definition.elements}
        initialAnswers={defaultAnswersFromElements(definition.elements)}
        initialAssessmentDate={todayDateInput()}
        sessionNoteId={sessionNoteId}
        returnTo={returnTo}
        saveAction={saveAction}
      />
    </AppShell>
  )
}
