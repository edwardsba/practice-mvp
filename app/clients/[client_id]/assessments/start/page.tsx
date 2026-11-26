import { and, asc, eq, sql } from "drizzle-orm"
import { notFound } from "next/navigation"

import { StartAssessmentRow } from "@/app/clients/[client_id]/assessments/start/start-assessment-row"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  assessmentDefinitions,
  assessmentElements,
  clients,
  sessionNotes,
} from "@/db/schema"
import { buildPractitionerStartHref } from "@/lib/assessments/practitioner-routes"
import {
  buildStartAssessmentList,
  chooseTodaysSessionNote,
  startAttachmentLine,
} from "@/lib/assessments/start-list"
import { requirePractitionerContext } from "@/lib/auth"
import { todayDateString } from "@/lib/dates/practice-time"
import { db } from "@/lib/db"
import { safeReturnTo } from "@/lib/navigation/safe-return-to"

export default async function StartAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { client_id: clientId } = await params
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

  const definitions = await db
    .select({
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
      clientCompletable: assessmentDefinitions.clientCompletable,
      practitionerCompletable: assessmentDefinitions.practitionerCompletable,
      isActive: assessmentDefinitions.isActive,
      elementCount: sql<number>`count(${assessmentElements.assessmentElementId})::int`,
    })
    .from(assessmentDefinitions)
    .leftJoin(
      assessmentElements,
      and(
        eq(
          assessmentElements.assessmentDefinitionId,
          assessmentDefinitions.assessmentDefinitionId
        ),
        eq(assessmentElements.isActive, true)
      )
    )
    .groupBy(
      assessmentDefinitions.assessmentDefinitionId,
      assessmentDefinitions.assessmentCode,
      assessmentDefinitions.assessmentName,
      assessmentDefinitions.clientCompletable,
      assessmentDefinitions.practitionerCompletable,
      assessmentDefinitions.isActive
    )
    .orderBy(asc(assessmentDefinitions.assessmentCode))

  const { practitioner, client: clientRows } = buildStartAssessmentList(
    definitions.map((row) => ({
      ...row,
      elementCount: Number(row.elementCount) || 0,
    }))
  )

  const today = todayDateString()
  const notes = await db
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      sessionDate: sessionNotes.sessionDate,
    })
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.clientId, clientId),
        eq(sessionNotes.practiceId, context.practiceId),
        eq(sessionNotes.isActive, true)
      )
    )

  const todaysNote = chooseTodaysSessionNote(notes, today)
  const returnTo =
    safeReturnTo(query.returnTo) ?? `/clients/${clientId}/assessments`
  const clientName = `${client.firstName} ${client.lastName}`
  const startReturnTo = returnTo

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref={returnTo} label="← Back" />
      </div>
      <EntityPageHeader kicker="Assessments" name="Start assessment" />

      <p className="mb-6 text-sm text-muted-foreground">
        {startAttachmentLine(todaysNote, today)}
      </p>

      <section className="mb-8 space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Practitioner assessments
        </h2>
        <ul className="divide-y rounded-lg border">
          {practitioner.map((row) => (
            <StartAssessmentRow
              key={row.assessmentCode}
              name={row.assessmentName}
              href={buildPractitionerStartHref({
                clientId,
                assessmentCode: row.assessmentCode,
                sessionNoteId: todaysNote?.sessionNoteId ?? null,
                returnTo: startReturnTo,
              })}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Client questionnaires (completed with the client)
        </h2>
        <ul className="divide-y rounded-lg border">
          {clientRows.map((row) =>
            row.enabled ? (
              <StartAssessmentRow
                key={row.assessmentCode}
                name={row.assessmentName}
                href={buildPractitionerStartHref({
                  clientId,
                  assessmentCode: row.assessmentCode,
                  sessionNoteId: todaysNote?.sessionNoteId ?? null,
                  returnTo: startReturnTo,
                })}
              />
            ) : (
              <StartAssessmentRow
                key={row.assessmentCode}
                name={row.assessmentName}
                badge={row.disabledNote ?? "Coming soon"}
              />
            )
          )}
        </ul>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">{clientName}</p>
    </AppShell>
  )
}
