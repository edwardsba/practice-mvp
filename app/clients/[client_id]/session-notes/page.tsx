import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { createDraftSessionNote } from "@/app/session-notes/actions"
import { AsqStatusBadge } from "@/components/session-notes/asq-status-badge"
import { PsqStatusBadge } from "@/components/session-notes/psq-status-badge"
import { SessionNotePdfDownloadLink } from "@/components/session-notes/session-note-pdf-download-link"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
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
  formatSessionNoteTime,
} from "@/lib/session-notes/format"
import { loadSessionNotesForPractice } from "@/lib/session-notes/load"
import { SESSION_NOTE_STATUS_CONFIG } from "@/lib/status"

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
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>PSQ</TableHead>
              <TableHead>ASQ</TableHead>
              <TableHead>PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
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
                        {formatSessionNoteTime(note.sessionTime)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={noteHref} className="block">
                        <StatusBadge
                          status={note.status}
                          statusMap={SESSION_NOTE_STATUS_CONFIG}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={noteHref} className="block">
                        <PsqStatusBadge
                          sentAt={note.preSessionBatterySentAt}
                          psqBatteryStatus={note.psqBatteryStatus}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={noteHref} className="block">
                        <AsqStatusBadge asqCompleted={note.asqCompleted} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      {note.status === "finalised" && note.pdfStoragePath ? (
                        <SessionNotePdfDownloadLink
                          sessionNoteId={note.sessionNoteId}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
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
