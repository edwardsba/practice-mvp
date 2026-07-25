import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { MseForm } from "@/app/clients/[client_id]/mse/new/mse-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { clients } from "@/db/schema"
import { loadMseQuestionnaire } from "@/lib/assessments/load-mse"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function AdministerMsePage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{ session_note_id?: string; returnTo?: string }>
}) {
  const { client_id: clientId } = await params
  const { session_note_id: sessionNoteIdParam, returnTo: returnToParam } =
    await searchParams
  const sessionNoteId = sessionNoteIdParam?.trim() || null
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

  const questions = await loadMseQuestionnaire()
  if (!questions?.length) {
    notFound()
  }

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader
        kicker="MSE"
        name={clientName}
        subheading="New MSE"
      />

      <MseForm
        clientId={clientId}
        clientName={clientName}
        questions={questions}
        sessionNoteId={sessionNoteId}
        returnTo={returnTo}
      />
    </AppShell>
  )
}
