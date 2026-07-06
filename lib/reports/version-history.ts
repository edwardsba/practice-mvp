import { and, eq, inArray } from "drizzle-orm"

import { simpleReports } from "@/db/schema"
import { db } from "@/lib/db"

export type ReportVersionSummary = {
  simpleReportId: string
  versionNumber: number
  isCurrentVersion: boolean
  reportStatus: string
  createdAt: Date
  finalisedAt: Date | null
}

export async function loadReportVersionHistory(
  reportId: string,
  practiceId: string
): Promise<ReportVersionSummary[]> {
  const columns = {
    simpleReportId: simpleReports.simpleReportId,
    versionNumber: simpleReports.versionNumber,
    isCurrentVersion: simpleReports.isCurrentVersion,
    reportStatus: simpleReports.reportStatus,
    createdAt: simpleReports.createdAt,
    finalisedAt: simpleReports.finalisedAt,
    previousVersionId: simpleReports.previousVersionId,
  }

  const found = new Map<
    string,
    ReportVersionSummary & { previousVersionId: string | null }
  >()

  let currentId: string | null = reportId
  while (currentId && !found.has(currentId)) {
    const [row] = await db
      .select(columns)
      .from(simpleReports)
      .where(
        and(
          eq(simpleReports.simpleReportId, currentId),
          eq(simpleReports.practiceId, practiceId)
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
      .from(simpleReports)
      .where(
        and(
          inArray(simpleReports.previousVersionId, frontier),
          eq(simpleReports.practiceId, practiceId)
        )
      )
    const newRows = next.filter((r) => !found.has(r.simpleReportId))
    if (newRows.length === 0) break
    for (const row of newRows) {
      found.set(row.simpleReportId, row)
    }
    frontier = newRows.map((r) => r.simpleReportId)
  }

  return Array.from(found.values())
    .sort((a, b) => a.versionNumber - b.versionNumber)
    .map(({ previousVersionId: _drop, ...rest }) => rest)
}
