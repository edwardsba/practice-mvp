import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { createDraftSessionNote } from "@/app/session-notes/actions"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { appendReturnTo } from "@/lib/navigation/back"
import { db } from "@/lib/db"
import {
  formatSessionNoteDate,
  formatSessionNoteStatus,
} from "@/lib/session-notes/format"
import { loadSessionNotesForPractice } from "@/lib/session-notes/load"

export default async function ClientSessionNotesPage({
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

  const notes = await loadSessionNotesForPractice(
    context.practiceId,
    "all",
    clientId
  )
  const clientName = `${client.firstName} ${client.lastName}`
  const returnTo = `/clients/${clientId}/session-notes`

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← {clientName}</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Session Notes — {clientName}
          </h1>
          <form action={createDraftSessionNote.bind(null, clientId, null)}>
            <Button type="submit">New Session Note</Button>
          </form>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="h-20 text-center text-muted-foreground"
                >
                  No session notes yet.
                </TableCell>
              </TableRow>
            ) : (
              notes.map((note) => {
                const noteHref = appendReturnTo(
                  `/session-notes/${note.sessionNoteId}`,
                  returnTo
                )
                return (
                  <TableRow
                    key={note.sessionNoteId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={noteHref}
                        className="block font-medium text-primary hover:underline"
                      >
                        {formatSessionNoteDate(note.sessionDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={noteHref} className="block hover:underline">
                        {formatSessionNoteStatus(note.status)}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
