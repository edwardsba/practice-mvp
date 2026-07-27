import { and, eq, inArray } from "drizzle-orm"

import { sessionNotes } from "@/db/schema"
import { db } from "@/lib/db"

export type SessionNoteVersionSummary = {
  sessionNoteId: string
  versionNumber: number
  isCurrentVersion: boolean
  status: string
  createdAt: Date
  finalisedAt: Date | null
}

export async function loadSessionNoteVersionHistory(
  sessionNoteId: string,
  practiceId: string
): Promise<SessionNoteVersionSummary[]> {
  const columns = {
    sessionNoteId: sessionNotes.sessionNoteId,
    versionNumber: sessionNotes.versionNumber,
    isCurrentVersion: sessionNotes.isCurrentVersion,
    status: sessionNotes.status,
    createdAt: sessionNotes.createdAt,
    finalisedAt: sessionNotes.finalisedAt,
    previousVersionId: sessionNotes.previousVersionId,
  }

  const found = new Map<
    string,
    SessionNoteVersionSummary & { previousVersionId: string | null }
  >()

  let currentId: string | null = sessionNoteId
  while (currentId && !found.has(currentId)) {
    const [row] = await db
      .select(columns)
      .from(sessionNotes)
      .where(
        and(
          eq(sessionNotes.sessionNoteId, currentId),
          eq(sessionNotes.practiceId, practiceId)
        )
      )
      .limit(1)
    if (!row) break
    found.set(currentId, row)
    currentId = row.previousVersionId
  }

  let frontier = Array.from(found.keys())
  while (frontier.length > 0) {
    const next = await db
      .select(columns)
      .from(sessionNotes)
      .where(
        and(
          inArray(sessionNotes.previousVersionId, frontier),
          eq(sessionNotes.practiceId, practiceId)
        )
      )
    const newRows = next.filter((r) => !found.has(r.sessionNoteId))
    if (newRows.length === 0) break
    for (const row of newRows) {
      found.set(row.sessionNoteId, row)
    }
    frontier = newRows.map((r) => r.sessionNoteId)
  }

  return Array.from(found.values())
    .sort((a, b) => a.versionNumber - b.versionNumber)
    .map(({ previousVersionId: _drop, ...rest }) => rest)
}
