import Link from "next/link"
import { notFound } from "next/navigation"

import { createCrisisPlan } from "@/app/clients/[client_id]/crisis-plan/actions"
import { CrisisPlanForm } from "@/components/crisis-plan/crisis-plan-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
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
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← Back to client</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create crisis plan
        </h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <CrisisPlanForm
        action={createCrisisPlan.bind(null, clientId)}
        initialContacts={contacts}
        submitLabel="Save crisis plan"
        cancelHref={`/clients/${clientId}`}
      />
    </AppShell>
  )
}
