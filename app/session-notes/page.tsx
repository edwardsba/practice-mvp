import Link from "next/link"

import { SessionNotesFilter } from "@/app/session-notes/session-notes-filter"
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
import { formatClientNameLastFirst } from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"
import {
  SESSION_NOTE_FILTER_VALUES,
  type SessionNoteFilter,
} from "@/lib/session-notes/constants"
import {
  formatSessionNoteDate,
  formatSessionNoteStatus,
  formatSessionNoteTime,
} from "@/lib/session-notes/format"
import { loadSessionNotesForPractice } from "@/lib/session-notes/load"

function parseFilter(value: string | undefined): SessionNoteFilter {
  if (
    value &&
    SESSION_NOTE_FILTER_VALUES.includes(value as SessionNoteFilter)
  ) {
    return value as SessionNoteFilter
  }
  return "all"
}

export default async function SessionNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; client_id?: string }>
}) {
  const { filter: filterParam, client_id: clientIdParam } = await searchParams
  const filter = parseFilter(filterParam)
  const clientId = clientIdParam?.trim() || undefined
  const context = await requirePractitionerContext()

  const notes = await loadSessionNotesForPractice(
    context.practiceId,
    filter,
    clientId
  )

  const newHref = clientId
    ? `/session-notes/new?client_id=${clientId}`
    : "/session-notes/new"

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Session Notes
          </h1>
          {clientId ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Showing notes for one client.{" "}
              <Link href="/session-notes" className="text-primary hover:underline">
                View all
              </Link>
            </p>
          ) : null}
        </div>
        <Button asChild>
          <Link href={newHref}>New Session Note</Link>
        </Button>
      </div>

      <div className="mb-6">
        <SessionNotesFilter currentFilter={filter} clientId={clientId} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-20 text-center text-muted-foreground"
                >
                  No session notes yet.
                </TableCell>
              </TableRow>
            ) : (
              notes.map((note) => {
                const clientName = formatClientNameLastFirst(
                  note.clientFirstName,
                  note.clientLastName
                )

                return (
                  <TableRow key={note.sessionNoteId}>
                    <TableCell>
                      {formatSessionNoteDate(note.sessionDate)}
                    </TableCell>
                    <TableCell>
                      {formatSessionNoteTime(note.sessionTime)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clients/${note.clientId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatSessionNoteStatus(note.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-3 text-sm">
                        <Link
                          href={`/session-notes/${note.sessionNoteId}`}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                        {note.status === "draft" ? (
                          <Link
                            href={`/session-notes/${note.sessionNoteId}/edit`}
                            className="text-primary hover:underline"
                          >
                            Edit
                          </Link>
                        ) : null}
                      </div>
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
