import Link from "next/link"
import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { AsqForm } from "@/app/clients/[client_id]/asq/new/asq-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { clients } from "@/db/schema"
import { loadAsqQuestionnaire } from "@/lib/assessments/load-asq"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function AdministerAsqPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { client_id: clientId } = await params
  const { returnTo } = await searchParams
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

  const questions = await loadAsqQuestionnaire()
  if (!questions?.length) {
    notFound()
  }

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={returnTo ?? `/clients/${clientId}`}>← Back to client</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Administer ASQ</h1>
        <p className="mt-1 text-sm text-muted-foreground">{clientName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ask Suicide-Screening Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <AsqForm clientId={clientId} clientName={clientName} questions={questions} />
        </CardContent>
      </Card>
    </AppShell>
  )
}
