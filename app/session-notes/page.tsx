import Link from "next/link"

import { SessionNotesFilter } from "@/app/session-notes/session-notes-filter"
import { AppShell } from "@/components/app-shell"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { AsqStatusBadge } from "@/components/session-notes/asq-status-badge"
import { PsqStatusBadge } from "@/components/session-notes/psq-status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatClientNameLastFirst } from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"
import { appendReturnTo } from "@/lib/navigation/back"
import { SESSION_NOTE_STATUS_CONFIG } from "@/lib/status"
import {
  SESSION_NOTE_FILTER_VALUES,
  type SessionNoteFilter,
} from "@/lib/session-notes/constants"
import {
  formatSessionNoteDate,
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
  const listReturnTo = clientId
    ? `/session-notes?client_id=${encodeURIComponent(clientId)}${
        filter !== "all" ? `&filter=${filter}` : ""
      }`
    : null

  return (
    <AppShell>
      <ListPageHeader heading="Session Notes" />

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
              <TableHead>PSQ</TableHead>
              <TableHead>ASQ</TableHead>
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
                const clientName = formatClientNameLastFirst(
                  note.clientFirstName,
                  note.clientLastName
                )
                const noteHref = listReturnTo
                  ? appendReturnTo(
                      `/session-notes/${note.sessionNoteId}`,
                      listReturnTo
                    )
                  : `/session-notes/${note.sessionNoteId}`

                return (
                  <TableRow
                    key={note.sessionNoteId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={noteHref} className="block">
                        {formatSessionNoteDate(note.sessionDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={noteHref} className="block">
                        {formatSessionNoteTime(note.sessionTime)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={noteHref} className="block">
                        {clientName}
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
