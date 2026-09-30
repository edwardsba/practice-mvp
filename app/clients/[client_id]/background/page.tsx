import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { ClientBackgroundPage } from "@/components/client-background/client-background-page"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { loadClientBackground } from "@/lib/client-background/load"
import { ensureFamilyOfOrigin } from "@/lib/client-background/mutations"
import { db } from "@/lib/db"

export default async function ClientBackgroundRoute({
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

  if (!client) notFound()

  await ensureFamilyOfOrigin({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
  })

  const data = await loadClientBackground(clientId, context.practiceId)
  if (!data) notFound()

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref={`/clients/${clientId}`} label={`← ${clientName}`} />
      </div>
      <EntityPageHeader
        kicker="Client Background"
        name={clientName}
        subheading="Demographics, relationships, history, and risk"
      />
      <ClientBackgroundPage clientId={clientId} data={data} />
    </AppShell>
  )
}
