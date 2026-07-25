import Link from "next/link"
import { notFound } from "next/navigation"

import { CrisisPlanForm } from "@/components/crisis-plan/crisis-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  loadEmergencyContacts,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewCrisisPlanPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()

  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    notFound()
  }

  const contacts = await loadEmergencyContacts(clientId, context.practiceId)
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
        kicker="Crisis plan"
        name={clientName}
        subheading="New crisis plan"
      />

      <CrisisPlanForm
        clientId={clientId}
        sourcePlanId={null}
        initialContacts={contacts}
        cancelHref={`/clients/${clientId}`}
      />
    </AppShell>
  )
}
