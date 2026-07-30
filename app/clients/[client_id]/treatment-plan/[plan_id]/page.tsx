import Link from "next/link"
import { notFound } from "next/navigation"

import { TreatmentPlanView } from "@/components/treatment-plan/treatment-plan-view"
import { TreatmentPlanToolbar } from "@/components/treatment-plan/treatment-plan-toolbar"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  loadTreatmentPlanForPractice,
  loadTreatmentPlanVersions,
  verifyClientInPractice,
} from "@/lib/treatment-plans/load"
import { requirePractitionerContext } from "@/lib/auth"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"

function formatVersionDate(value: Date) {
  return value.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function TreatmentPlanViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string; plan_id: string }>
  searchParams: Promise<{ openSend?: string }>
}) {
  const { client_id: clientId, plan_id: planId } = await params
  const { openSend } = await searchParams
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

  const [versions, emailContext] = await Promise.all([
    loadTreatmentPlanVersions(clientId, context.practiceId),
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
      </div>
      <EntityPageHeader
        kicker="Treatment plan"
        name={clientName}
        subheading={`v${plan.versionNumber} - Created ${plan.createdAt.toLocaleDateString(
          "en-AU",
          { day: "numeric", month: "long", year: "numeric" }
        )}`}
        badge={
          <Badge variant={plan.isActive ? "default" : "outline"}>
            {plan.isActive ? "Current version" : "Superseded"}
          </Badge>
        }
        subheadingAction={
          plan.isActive ? (
            <Button variant="outline" asChild>
              <Link
                href={`/clients/${clientId}/treatment-plan/${planId}/edit`}
              >
                Edit / Create new version
              </Link>
            </Button>
          ) : undefined
        }
        actionRow={
          <TreatmentPlanToolbar
            treatmentPlanId={planId}
            clientEmail={client.email?.trim() || null}
            templateVariables={{
              client_first_name: client.firstName.trim() || "there",
              practice_name: emailContext?.practiceName ?? "your practice",
              practitioner_name:
                emailContext?.practitionerName ?? "your practitioner",
            }}
            autoOpenSend={openSend === "1"}
          />
        }
      />

      <TreatmentPlanView plan={plan} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
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
