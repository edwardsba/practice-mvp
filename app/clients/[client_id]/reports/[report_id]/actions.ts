"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auditEvents, simpleReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type FinaliseReportState = {
  error?: string
  success?: boolean
}

export async function finaliseReport(
  clientId: string,
  reportId: string,
  _prevState: FinaliseReportState,
  _formData: FormData
): Promise<FinaliseReportState> {
  const context = await requirePractitionerContext()

  const [report] = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      reportStatus: simpleReports.reportStatus,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.simpleReportId, reportId),
        eq(simpleReports.clientId, clientId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!report) {
    return { error: "Report not found." }
  }

  if (report.reportStatus === "finalised") {
    return { success: true }
  }

  const now = new Date()

  await db
    .update(simpleReports)
    .set({
      reportStatus: "finalised",
      finalisedAt: now,
      updatedAt: now,
    })
    .where(eq(simpleReports.simpleReportId, reportId))

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "report.finalised",
    entityType: "simple_report",
    entityId: reportId,
  })

  revalidatePath(`/clients/${clientId}/reports/${reportId}`)
  revalidatePath(`/clients/${clientId}`)

  return { success: true }
}
