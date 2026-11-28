import { notFound } from "next/navigation"

import { TreatmentPlanForm } from "@/components/treatment-plan/treatment-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { verifyClientInPractice } from "@/lib/treatment-plans/load"
import { loadActiveCrisisPlanSummary } from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import {
  loadMedicationEventsForClient,
  loadProfessionalsForOngoingMedicationPrescribers,
} from "@/lib/medical-contacts/load"
import { formatMedicationSupervisedAnswer } from "@/lib/medical-contacts/rules"

export default async function NewTreatmentPlanPage({
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
          page="/clients/[client_id]/treatment-plan/new"
          data={{ clientId, clientName }}
        />
      </div>
      <EntityPageHeader
        kicker="Treatment plan"
        name={clientName}
        subheading="New treatment plan"
      />

      <TreatmentPlanForm
        clientId={clientId}
        sourcePlanId={null}
        cancelHref={`/clients/${clientId}`}
        crisisPlanSummary={crisisPlanSummary}
        medicationSupervisedLine={medicationSupervised.fullLine}
      />
    </AppShell>
  )
}
