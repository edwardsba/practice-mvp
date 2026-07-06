import Link from "next/link"
import { notFound } from "next/navigation"

import { deleteTreatmentPlan } from "@/app/clients/[client_id]/treatment-plan/actions"
import { TreatmentPlanForm } from "@/components/treatment-plan/treatment-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { Badge } from "@/components/ui/badge"
import {
  loadTreatmentPlanForPractice,
  verifyClientInPractice,
} from "@/lib/treatment-plans/load"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditTreatmentPlanPage({
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

  const plan = await loadTreatmentPlanForPractice(
    planId,
    clientId,
    context.practiceId
  )
  if (!plan) {
    notFound()
  }

  if (!plan.isActive) {
    notFound()
  }

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}/treatment-plan/${planId}`}
          label="← Back to treatment plan"
        />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit treatment plan
          </h1>
          <Badge variant="secondary">Version {plan.versionNumber}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          {clientName} — saving creates version {plan.versionNumber + 1} and
          archives prior versions.
        </p>
      </div>

      <TreatmentPlanForm
        clientId={clientId}
        sourcePlanId={planId}
        initialPlan={plan}
        isNewVersion
        cancelHref={`/clients/${clientId}/treatment-plan/${planId}`}
      />

      <EntityDeleteSection
        entityName="Treatment Plan"
        deleteAction={deleteTreatmentPlan.bind(null, planId, context.practiceId)}
      />
    </AppShell>
  )
}
