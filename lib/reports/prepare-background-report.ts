import { and, eq } from "drizzle-orm"

import { simpleReports } from "@/db/schema"
import { db } from "@/lib/db"
import { parseLetterBodyJson } from "@/lib/reports/letter-body-types"
import {
  generateBackgroundReport,
  type BackgroundReportOmission,
  type BackgroundReportSource,
} from "@/lib/reports/generate-background-report"
import { loadBackgroundReportSource } from "@/lib/reports/load-background-report-source"
import { parseReportSnapshot, type ReportSnapshot } from "@/lib/reports/snapshot"

async function storedBackground(
  reportId: string | null,
  practiceId: string
): Promise<{
  letter: ReturnType<typeof parseLetterBodyJson>
  background: BackgroundReportSource | null
  omissions: BackgroundReportOmission[] | null
} | null> {
  if (!reportId) return null
  const [row] = await db
    .select({
      letterBodyJson: simpleReports.letterBodyJson,
      valuesSnapshotJson: simpleReports.valuesSnapshotJson,
    })
    .from(simpleReports)
    .where(and(eq(simpleReports.simpleReportId, reportId), eq(simpleReports.practiceId, practiceId)))
    .limit(1)
  if (!row) return null
  const snapshot = parseReportSnapshot(row.valuesSnapshotJson)
  return {
    letter: parseLetterBodyJson(row.letterBodyJson),
    background: snapshot?.background ?? null,
    omissions: snapshot?.background ? (snapshot.backgroundOmissions ?? []) : null,
  }
}

/**
 * Writes the Background letter once. Later saves keep the edited text and the
 * snapshot of what that text was written from. A new version starts from the
 * previous version's text.
 */
export async function attachBackgroundReport({
  snapshot,
  practiceId,
  clientId,
  practitionerProfileId,
  existingDraftReportId,
  previousVersionId,
  formLetterBodyJson,
}: {
  snapshot: ReportSnapshot
  practiceId: string
  clientId: string
  practitionerProfileId: string
  existingDraftReportId: string | null
  previousVersionId: string | null
  formLetterBodyJson: unknown
}): Promise<ReportSnapshot> {
  const fromForm = parseLetterBodyJson(formLetterBodyJson)
  const existing = await storedBackground(existingDraftReportId, practiceId)
  const previous =
    previousVersionId && previousVersionId !== existingDraftReportId
      ? await storedBackground(previousVersionId, practiceId)
      : null
  const letter = fromForm ?? existing?.letter ?? previous?.letter ?? null
  const carried = existing?.background ? existing : previous?.background ? previous : null
  const background = carried?.background ?? null
  const omissions = carried?.omissions ?? null

  if (letter && background && omissions) {
    return {
      ...snapshot,
      letterBodyJson: letter,
      background,
      backgroundOmissions: omissions,
    }
  }

  const source =
    background ??
    (await loadBackgroundReportSource({
      clientId,
      practiceId,
      practitionerProfileId,
      reportDate: snapshot.reportDate,
    }))
  if (!source) {
    return { ...snapshot, letterBodyJson: letter, background, backgroundOmissions: omissions ?? [] }
  }

  const generated = generateBackgroundReport(source)
  return {
    ...snapshot,
    letterBodyJson: letter ?? generated.document,
    background: source,
    backgroundOmissions: omissions ?? generated.omitted,
  }
}
