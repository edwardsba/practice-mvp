import { eq } from "drizzle-orm"

import { simpleReports } from "@/db/schema"
import { db } from "@/lib/db"
import {
  generateLetterBody,
  generateReferralAcknowledgementLetterBody,
} from "@/lib/reports/generate-letter-body"
import type { LetterBodyDoc } from "@/lib/reports/letter-body-types"
import { parseLetterBodyJson } from "@/lib/reports/letter-body-types"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import { resolveTemplateKey } from "@/lib/reports/templates"

export async function resolveLetterBodyJson({
  templateKey,
  snapshot,
  existingDraftReportId,
  previousVersionId,
  formLetterBodyJson,
}: {
  templateKey: string
  snapshot: ReportSnapshot
  existingDraftReportId: string | null
  previousVersionId: string | null
  formLetterBodyJson: unknown
}): Promise<LetterBodyDoc | null> {
  const fromForm = parseLetterBodyJson(formLetterBodyJson)
  if (fromForm) {
    return fromForm
  }

  if (existingDraftReportId) {
    const [row] = await db
      .select({ letterBodyJson: simpleReports.letterBodyJson })
      .from(simpleReports)
      .where(eq(simpleReports.simpleReportId, existingDraftReportId))
      .limit(1)
    return parseLetterBodyJson(row?.letterBodyJson)
  }

  if (previousVersionId) {
    const [row] = await db
      .select({ letterBodyJson: simpleReports.letterBodyJson })
      .from(simpleReports)
      .where(eq(simpleReports.simpleReportId, previousVersionId))
      .limit(1)
    const previousBody = parseLetterBodyJson(row?.letterBodyJson)
    if (previousBody) {
      return previousBody
    }
  }

  const key = resolveTemplateKey(templateKey)
  if (key === "referral_acknowledgement") {
    return generateReferralAcknowledgementLetterBody(snapshot)
  }
  if (key === "background_report") {
    return null
  }
  return generateLetterBody(snapshot)
}

export function attachLetterBodyToSnapshot(
  snapshot: ReportSnapshot,
  letterBodyJson: LetterBodyDoc | null
): ReportSnapshot {
  return {
    ...snapshot,
    letterBodyJson,
  }
}
