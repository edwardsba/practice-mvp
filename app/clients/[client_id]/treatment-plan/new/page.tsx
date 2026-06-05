import Link from "next/link"
import { notFound } from "next/navigation"

import { createTreatmentPlan } from "@/app/clients/[client_id]/treatment-plan/actions"
import { TreatmentPlanForm } from "@/components/treatment-plan/treatment-plan-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { verifyClientInPractice } from "@/lib/treatment-plans/load"
import { requirePractitionerContext } from "@/lib/auth"

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

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← Back to client</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create treatment plan
        </h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <TreatmentPlanForm
        action={createTreatmentPlan.bind(null, clientId)}
        submitLabel="Save treatment plan"
        cancelHref={`/clients/${clientId}`}
      />
    </AppShell>
  )
}
