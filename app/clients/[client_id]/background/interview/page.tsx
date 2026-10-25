import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { InterviewPage } from "@/components/client-background/interview-page"
import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { loadClientBackground, loadInProgressInterview, loadLatestBackgroundSelfReport } from "@/lib/client-background/load"
import { ensureFamilyOfOrigin } from "@/lib/client-background/mutations"
import { db } from "@/lib/db"

export default async function BackgroundInterviewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{ page?: string }>
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
      and(eq(clients.clientId, clientId), eq(clients.practiceId, context.practiceId), eq(clients.isActive, true))
    )
    .limit(1)

  if (!client) notFound()

  const interview = await loadInProgressInterview(clientId, context.practiceId)
  if (!interview) redirect(`/clients/${clientId}/background`)

  await ensureFamilyOfOrigin({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
  })

  const data = await loadClientBackground(clientId, context.practiceId)
  if (!data) notFound()

  const selfReport = await loadLatestBackgroundSelfReport(clientId, context.practiceId)

  return (
    <AppShell>
      <InterviewPage
        clientId={clientId}
        clientName={`${client.firstName} ${client.lastName}`.trim()}
        initialPage={query.page === "history" ? "history" : "background"}
        data={data}
        screening={interview.screening}
        selfReport={selfReport}
      />
    </AppShell>
  )
}
