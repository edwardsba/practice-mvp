import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { EmergencyContactEditForm } from "@/app/clients/[client_id]/emergency-contacts/[contact_id]/edit/emergency-contact-edit-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { loadEmergencyContactById } from "@/lib/crisis-plans/load"
import { db } from "@/lib/db"

export default async function EditEmergencyContactPage({
  params,
}: {
  params: Promise<{ client_id: string; contact_id: string }>
}) {
  const { client_id: clientId, contact_id: contactId } = await params
  const context = await requirePractitionerContext()

  const contact = await loadEmergencyContactById(
    contactId,
    clientId,
    context.practiceId
  )

  if (!contact) {
    notFound()
  }

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
        kicker="Emergency contact edit"
        name={clientName}
        subheading={contact.name}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <EmergencyContactEditForm
            clientId={clientId}
            contact={contact}
          />
        </CardContent>
      </Card>
    </AppShell>
  )
}
