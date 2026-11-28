import { notFound } from "next/navigation"

import { deleteTreatmentPlan } from "@/app/clients/[client_id]/treatment-plan/actions"
import { TreatmentPlanForm } from "@/components/treatment-plan/treatment-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { Badge } from "@/components/ui/badge"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  loadTreatmentPlanForPractice,
  verifyClientInPractice,
} from "@/lib/treatment-plans/load"
import { loadActiveCrisisPlanSummary } from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import {
  loadMedicationEventsForClient,
  loadProfessionalsForOngoingMedicationPrescribers,
} from "@/lib/medical-contacts/load"
import { formatMedicationSupervisedAnswer } from "@/lib/medical-contacts/rules"

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

  const [crisisPlanSummary, medicationEvents, medicationProfessionals] =
    await Promise.all([
      loadActiveCrisisPlanSummary(clientId, context.practiceId),
      loadMedicationEventsForClient(clientId, context.practiceId),
      loadProfessionalsForOngoingMedicationPrescribers(
        clientId,
        context.practiceId
      ),
    ])
  const medicationSupervised = formatMedicationSupervisedAnswer(
    medicationEvents,
    medicationProfessionals
  )

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          page="/clients/[client_id]/treatment-plan/[plan_id]/edit"
          data={{ clientId, clientName, planId }}
        />
      </div>
      <EntityPageHeader
        kicker="Treatment plan edit"
        name={clientName}
        subheading={`Saving creates version ${plan.versionNumber + 1} and archives prior versions.`}
        badge={<Badge variant="secondary">Version {plan.versionNumber}</Badge>}
      />

      <TreatmentPlanForm
        clientId={clientId}
        sourcePlanId={planId}
        initialPlan={plan}
        isNewVersion
        cancelHref={`/clients/${clientId}/treatment-plan/${planId}`}
        crisisPlanSummary={crisisPlanSummary}
        medicationSupervisedLine={medicationSupervised.fullLine}
      />

      <EntityDeleteSection
        entityName="Treatment Plan"
        deleteAction={deleteTreatmentPlan.bind(null, planId, context.practiceId)}
      />
    </AppShell>
  )
}
