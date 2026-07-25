import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { AssessmentsTable } from "@/app/clients/[client_id]/assessments/assessments-table"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { clients } from "@/db/schema"
import { loadAssessmentResultsForClient } from "@/lib/assessments/load-results"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function ClientAssessmentsPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
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

  const results = await loadAssessmentResultsForClient(
    clientId,
    context.practiceId
  )
  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← {clientName}</Link>
        </Button>
      </div>
      <EntityPageHeader
        kicker="Assessments"
        name={clientName}
        subheading={`${results.length} result${results.length === 1 ? "" : "s"}`}
      />

      <AssessmentsTable clientId={clientId} results={results} />
    </AppShell>
  )
}
