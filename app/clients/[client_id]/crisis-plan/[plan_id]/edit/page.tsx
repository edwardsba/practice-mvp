import Link from "next/link"
import { notFound } from "next/navigation"

import { createCrisisPlanVersion } from "@/app/clients/[client_id]/crisis-plan/actions"
import { CrisisPlanForm } from "@/components/crisis-plan/crisis-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import {
  loadCrisisPlanForPractice,
  loadEmergencyContacts,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditCrisisPlanPage({
  params,
}: {
  params: Promise<{ client_id: string; plan_id: string }>
}) {
  const { client_id: clientId, plan_id: planId } = await params
  const context = await requirePractitionerContext()

  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    notFound()
  }

  const plan = await loadCrisisPlanForPractice(
    planId,
    clientId,
    context.practiceId
  )
  if (!plan || !plan.isActive) {
    notFound()
  }

  const contacts = await loadEmergencyContacts(clientId, context.practiceId)
  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}/crisis-plan/${planId}`}
          label="← Back to crisis plan"
        />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit crisis plan
          </h1>
          <Badge variant="secondary">Version {plan.versionNumber}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          {clientName} — saving creates version {plan.versionNumber + 1} and
          archives prior versions.
        </p>
      </div>

      <CrisisPlanForm
        action={createCrisisPlanVersion.bind(null, clientId, planId)}
        initialPlan={plan}
        initialContacts={contacts}
        submitLabel="Save new version"
        cancelHref={`/clients/${clientId}/crisis-plan/${planId}`}
      />
    </AppShell>
  )
}
