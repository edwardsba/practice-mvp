import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { EditClientForm } from "@/app/clients/[client_id]/edit/edit-client-form"
import { deleteClient, getClientDeleteStatus } from "@/app/clients/actions"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function EditClientPage({
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
      dateOfBirth: clients.dateOfBirth,
      email: clients.email,
      phone: clients.phone,
      address: clients.address,
      commsOptOut: clients.commsOptOut,
      reminderOptOut: clients.reminderOptOut,
      preSessionOptOut: clients.preSessionOptOut,
      postSessionOptOut: clients.postSessionOptOut,
      adminCommsOptOut: clients.adminCommsOptOut,
      onlineBookingPermitted: clients.onlineBookingPermitted,
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

  const deleteStatus = await getClientDeleteStatus(clientId)

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Edit client</h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Client details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditClientForm clientId={clientId} client={client} />
        </CardContent>
      </Card>

      <EntityDeleteSection
        entityName="Client"
        blockedReason={deleteStatus.blockedReason}
        requiresReportConfirmation={deleteStatus.requiresReportConfirmation}
        deleteAction={deleteClient.bind(null, clientId)}
      />
    </AppShell>
  )
}
