import Link from "next/link"
import { and, asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  clients,
  practitionerProfiles,
  sessionNotes,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { appendReturnTo } from "@/lib/navigation/back"
import { formatPractitionerName } from "@/lib/practitioner/format"
import { formatSessionNoteDate } from "@/lib/session-notes/format"

function formatCompletedDate(value: Date | string | null) {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatAdministeredDateTime(value: Date | string | null) {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

type ResponseRow = {
  questionText: string
  responseLabel: string
  displayOrder: number
  groupLabel: string | null
  subgroupLabel: string | null
}

function buildGroupedRows(responses: ResponseRow[]) {
  const sections: {
    key: string
    heading: string
    rows: ResponseRow[]
  }[] = []

  for (const row of responses) {
    const group = row.groupLabel ?? "Other"
    const subgroup = row.subgroupLabel
    const heading = subgroup ? `${group} — ${subgroup}` : group
    const key = `${group}:${subgroup ?? "_"}`
    const last = sections[sections.length - 1]
    if (!last || last.key !== key) {
      sections.push({ key, heading, rows: [row] })
    } else {
      last.rows.push(row)
    }
  }

  return sections
}

export default async function ViewMsePage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string; instance_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { client_id: clientId, instance_id: instanceId } = await params
  const { returnTo: returnToParam } = await searchParams
  const returnTo = returnToParam?.trim() || null
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    notFound()
  }

  const [instance] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      sessionNoteId: assessmentInstances.sessionNoteId,
      submittedAt: assessmentInstances.submittedAt,
      assessmentName: assessmentDefinitions.assessmentName,
      practitionerFirstName: practitionerProfiles.firstName,
      practitionerPreferredName: practitionerProfiles.preferredName,
      practitionerLastName: practitionerProfiles.lastName,
      practitionerTitle: practitionerProfiles.title,
      practitionerReportSignature: practitionerProfiles.reportSignature,
    })
    .from(assessmentInstances)
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .innerJoin(
      practitionerProfiles,
      eq(
        assessmentInstances.practitionerProfileId,
        practitionerProfiles.practitionerProfileId
      )
    )
    .where(
      and(
        eq(assessmentInstances.assessmentInstanceId, instanceId),
        eq(assessmentInstances.practiceId, context.practiceId),
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentDefinitions.assessmentCode, "mse")
      )
    )
    .limit(1)

  if (!instance) {
    notFound()
  }

  const responses = await db
    .select({
      questionText: assessmentElements.questionText,
      responseLabel: assessmentOptions.optionLabel,
      displayOrder: assessmentElements.displayOrder,
      groupLabel: assessmentElements.groupLabel,
      subgroupLabel: assessmentElements.subgroupLabel,
    })
    .from(assessmentResponses)
    .innerJoin(
      assessmentElements,
      eq(
        assessmentResponses.assessmentElementId,
        assessmentElements.assessmentElementId
      )
    )
    .innerJoin(
      assessmentOptions,
      and(
        eq(
          assessmentOptions.assessmentElementId,
          assessmentResponses.assessmentElementId
        ),
        eq(assessmentOptions.optionValue, assessmentResponses.responseValue)
      )
    )
    .where(eq(assessmentResponses.assessmentInstanceId, instanceId))
    .orderBy(asc(assessmentElements.displayOrder))

  let sessionNoteLabel: string | null = null
  if (instance.sessionNoteId) {
    const [note] = await db
      .select({
        sessionDate: sessionNotes.sessionDate,
      })
      .from(sessionNotes)
      .where(
        and(
          eq(sessionNotes.sessionNoteId, instance.sessionNoteId),
          eq(sessionNotes.practiceId, context.practiceId)
        )
      )
      .limit(1)

    if (note) {
      sessionNoteLabel = formatSessionNoteDate(note.sessionDate)
    }
  }

  const clientName = `${client.firstName} ${client.lastName}`
  const mseDetailUrl = returnTo
    ? `/clients/${clientId}/mse/${instanceId}?returnTo=${encodeURIComponent(returnTo)}`
    : `/clients/${clientId}/mse/${instanceId}`
  const practitionerName = formatPractitionerName({
    firstName: instance.practitionerFirstName,
    preferredName: instance.practitionerPreferredName,
    lastName: instance.practitionerLastName,
    title: instance.practitionerTitle,
    reportSignature: instance.practitionerReportSignature,
  })
  const grouped = buildGroupedRows(responses)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader
        kicker="MSE"
        name={clientName}
        subheading={`${instance.assessmentName} · Completed ${formatCompletedDate(instance.submittedAt)}`}
        action={
          <Link
            href={appendReturnTo(
              `/clients/${clientId}/mse/${instanceId}/edit`,
              mseDetailUrl
            )}
            className="text-sm font-medium text-primary hover:underline"
          >
            Edit MSE
          </Link>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Administered</dt>
              <dd className="font-medium">
                {formatAdministeredDateTime(instance.submittedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Practitioner</dt>
              <dd className="font-medium">{practitionerName || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Session note</dt>
              <dd className="font-medium">
                {instance.sessionNoteId && sessionNoteLabel ? (
                  <Link
                    href={`/session-notes/${instance.sessionNoteId}`}
                    className="text-primary hover:underline"
                  >
                    Session note — {sessionNoteLabel}
                  </Link>
                ) : instance.sessionNoteId ? (
                  <Link
                    href={`/session-notes/${instance.sessionNoteId}`}
                    className="text-primary hover:underline"
                  >
                    View session note
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question responses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Question</TableHead>
                  <TableHead>Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No response data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  grouped.flatMap((section) => [
                    <TableRow key={`heading-${section.key}`} className="bg-muted/40">
                      <TableCell
                        colSpan={2}
                        className="text-sm font-semibold"
                      >
                        {section.heading}
                      </TableCell>
                    </TableRow>,
                    ...section.rows.map((row) => (
                      <TableRow
                        key={`${section.key}-${row.displayOrder}-${row.questionText}`}
                      >
                        <TableCell className="whitespace-normal">
                          {row.questionText}
                        </TableCell>
                        <TableCell>{row.responseLabel}</TableCell>
                      </TableRow>
                    )),
                  ])
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
