import Link from "next/link"
import { notFound } from "next/navigation"

import { deleteCrisisPlan } from "@/app/clients/[client_id]/crisis-plan/actions"
import { CrisisPlanForm } from "@/components/crisis-plan/crisis-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { Badge } from "@/components/ui/badge"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
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
      </div>
      <EntityPageHeader
        kicker="Crisis plan edit"
        name={clientName}
        subheading={`Saving creates version ${plan.versionNumber + 1} and archives prior versions.`}
        badge={<Badge variant="secondary">Version {plan.versionNumber}</Badge>}
      />

      <CrisisPlanForm
        clientId={clientId}
        sourcePlanId={planId}
        initialPlan={plan}
        initialContacts={contacts}
        cancelHref={`/clients/${clientId}/crisis-plan/${planId}`}
      />

      <EntityDeleteSection
        entityName="Crisis Plan"
        deleteAction={deleteCrisisPlan.bind(null, planId, context.practiceId)}
      />
    </AppShell>
  )
}
