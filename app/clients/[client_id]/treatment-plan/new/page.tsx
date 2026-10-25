import Link from "next/link"
import { notFound } from "next/navigation"

import { TreatmentPlanForm } from "@/components/treatment-plan/treatment-plan-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { verifyClientInPractice } from "@/lib/treatment-plans/load"
import { loadActiveCrisisPlanSummary } from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import { loadMedicationRecord } from "@/lib/client-background/load"
import { medicationSupervisionFromRecord } from "@/lib/client-background/medication"
import { emptyMedication } from "@/lib/client-background/types"

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

  const crisisPlanSummary = await loadActiveCrisisPlanSummary(
    clientId,
    context.practiceId
  )
  const medication = (await loadMedicationRecord(clientId, context.practiceId)) ?? emptyMedication()

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
        kicker="Treatment plan"
        name={clientName}
        subheading="New treatment plan"
      />

      <TreatmentPlanForm
        clientId={clientId}
        sourcePlanId={null}
        cancelHref={`/clients/${clientId}`}
        crisisPlanSummary={crisisPlanSummary}
        medicationSupervision={medicationSupervisionFromRecord(medication)}
      />
    </AppShell>
  )
}
