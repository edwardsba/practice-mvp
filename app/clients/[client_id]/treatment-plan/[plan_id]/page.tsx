import Link from "next/link"
import { notFound } from "next/navigation"

import { TreatmentPlanView } from "@/components/treatment-plan/treatment-plan-view"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  loadTreatmentPlanForPractice,
  loadTreatmentPlanVersions,
  verifyClientInPractice,
} from "@/lib/treatment-plans/load"
import { requirePractitionerContext } from "@/lib/auth"

function formatVersionDate(value: Date) {
  return value.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function TreatmentPlanViewPage({
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

  const versions = await loadTreatmentPlanVersions(
    clientId,
    context.practiceId
  )

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← Back to client</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Treatment plan
              </h1>
              <Badge variant={plan.isActive ? "default" : "secondary"}>
                Version {plan.versionNumber}
                {plan.isActive ? " · Active" : ""}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{clientName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Created{" "}
              {plan.createdAt.toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          {plan.isActive ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link
                  href={`/clients/${clientId}/treatment-plan/${planId}/edit`}
                >
                  Edit / Create new version
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <TreatmentPlanView plan={plan} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>
            All treatment plan versions for this client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions found.</p>
          ) : (
            <ul className="space-y-2">
              {versions.map((version) => (
                <li key={version.treatmentPlanId}>
                  <Link
                    href={`/clients/${clientId}/treatment-plan/${version.treatmentPlanId}`}
                    className={`text-sm hover:underline ${
                      version.isActive
                        ? "font-semibold text-primary"
                        : "text-primary"
                    }`}
                  >
                    Version {version.versionNumber} —{" "}
                    {formatVersionDate(version.createdAt)}
                    {version.isActive ? (
                      <span className="ml-2 font-medium text-foreground">
                        (Active)
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  )
}
