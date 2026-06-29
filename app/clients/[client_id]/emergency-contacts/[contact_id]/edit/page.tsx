import { notFound } from "next/navigation"

import { EmergencyContactEditForm } from "@/app/clients/[client_id]/emergency-contacts/[contact_id]/edit/emergency-contact-edit-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePractitionerContext } from "@/lib/auth"
import { loadEmergencyContactById } from "@/lib/crisis-plans/load"

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

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit emergency contact
        </h1>
      </div>

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
