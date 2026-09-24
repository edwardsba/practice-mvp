import Link from "next/link"
import { notFound } from "next/navigation"

import { createIntakeInterviewVersionAction } from "@/app/clients/[client_id]/intake-interview/actions"
import { IntakeInterviewView } from "@/components/intake-interview/intake-interview-view"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePractitionerContext } from "@/lib/auth"
import {
  loadIntakeInterviewForPractice,
  loadIntakeInterviewVersions,
  verifyClientInPractice,
} from "@/lib/intake-interview/load"
import { INTAKE_INTERVIEW_STATUS_CONFIG } from "@/lib/status"

function formatDate(value: Date | string | null) {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function IntakeInterviewViewPage({
  params,
}: {
  params: Promise<{ client_id: string; interview_id: string }>
}) {
  const { client_id: clientId, interview_id: interviewId } = await params
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) notFound()

  const interview = await loadIntakeInterviewForPractice(
    interviewId,
    clientId,
    context.practiceId
  )
  if (!interview) notFound()

  const versions = await loadIntakeInterviewVersions(clientId, context.practiceId)
  const clientName = `${client.firstName} ${client.lastName}`
  const createVersion = createIntakeInterviewVersionAction.bind(
    null,
    clientId,
    interviewId
  )

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader
        kicker="Diagnostic intake interview"
        name={clientName}
        subheading={`v${interview.versionNumber} — ${formatDate(interview.interviewDate)}`}
        badge={
          <StatusBadge
            status={interview.status}
            statusMap={INTAKE_INTERVIEW_STATUS_CONFIG}
          />
        }
        subheadingAction={
          interview.status === "draft" ? (
            <Button variant="outline" asChild>
              <Link
                href={`/clients/${clientId}/intake-interview/${interviewId}/edit`}
              >
                Edit
              </Link>
            </Button>
          ) : interview.isCurrentVersion ? (
            <form action={createVersion}>
              <Button type="submit" variant="outline">
                Create new version
              </Button>
            </form>
          ) : undefined
        }
      />

      <IntakeInterviewView interview={interview} />

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
                <li key={version.intakeInterviewId}>
                  <Link
                    href={`/clients/${clientId}/intake-interview/${version.intakeInterviewId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Version {version.versionNumber} —{" "}
                    {formatDate(version.interviewDate ?? version.createdAt)}
                    {version.isCurrentVersion ? " (Current)" : ""}
                    {` · ${version.status}`}
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
