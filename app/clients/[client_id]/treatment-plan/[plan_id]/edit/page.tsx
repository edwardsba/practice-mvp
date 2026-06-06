import Link from "next/link"
import { notFound } from "next/navigation"

import { createTreatmentPlanVersion } from "@/app/clients/[client_id]/treatment-plan/actions"
import { TreatmentPlanForm } from "@/components/treatment-plan/treatment-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
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
  const saveAction = createTreatmentPlanVersion.bind(null, clientId, planId)

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
        action={saveAction}
        initialPlan={plan}
        submitLabel="Save new version"
        cancelHref={`/clients/${clientId}/treatment-plan/${planId}`}
      />
    </AppShell>
  )
}
