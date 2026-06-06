import Link from "next/link"
import { notFound } from "next/navigation"

import { CrisisPlanToolbar } from "@/components/crisis-plan/crisis-plan-toolbar"
import { CrisisPlanView } from "@/components/crisis-plan/crisis-plan-view"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import {
  loadCrisisPlanForPractice,
  loadCrisisPlanVersions,
  loadEmergencyContacts,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import { requirePractitionerContext } from "@/lib/auth"

function formatVersionDate(value: Date) {
  return value.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function CrisisPlanViewPage({
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
  if (!plan) {
    notFound()
  }

  const [contacts, versions, emailContext] = await Promise.all([
    loadEmergencyContacts(clientId, context.practiceId),
    loadCrisisPlanVersions(clientId, context.practiceId),
    getQuestionnaireEmailContext(
      context.practiceId,
      context.practitionerProfileId
    ),
  ])

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Crisis plan
              </h1>
              <Badge variant={plan.isActive ? "default" : "secondary"}>
                Version {plan.versionNumber}
                {plan.isActive ? " · Active" : ""}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{clientName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {formatVersionDate(plan.createdAt)}
            </p>
          </div>
          <CrisisPlanToolbar
            clientId={clientId}
            crisisPlanId={planId}
            isActive={plan.isActive}
            clientEmail={client.email?.trim() || null}
            templateVariables={{
              client_first_name: client.firstName.trim() || "there",
              practice_name: emailContext?.practiceName ?? "your practice",
              practitioner_name:
                emailContext?.practitionerName ?? "your practitioner",
            }}
          />
        </div>
      </div>

      <CrisisPlanView plan={plan} contacts={contacts} clientName={clientName} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {versions.map((version) => (
              <li key={version.crisisPlanId}>
                <Link
                  href={`/clients/${clientId}/crisis-plan/${version.crisisPlanId}`}
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
        </CardContent>
      </Card>
    </AppShell>
  )
}
