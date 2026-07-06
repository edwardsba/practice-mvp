"use server"

import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auditEvents, fundingApprovalReportLinks, simpleReports } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export async function deleteSimpleReport(
  reportId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    return { error: "Unauthorized practice access." }
  }

  const [report] = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      clientId: simpleReports.clientId,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.simpleReportId, reportId),
        eq(simpleReports.practiceId, practiceId),
        ne(simpleReports.reportStatus, "deleted")
      )
    )
    .limit(1)

  if (!report) {
    return { error: "Report not found." }
  }

  try {
    await db
      .update(simpleReports)
      .set({ reportStatus: "deleted", updatedAt: new Date() })
      .where(eq(simpleReports.simpleReportId, reportId))

    await db
      .update(fundingApprovalReportLinks)
      .set({ simpleReportId: null, updatedAt: new Date() })
      .where(eq(fundingApprovalReportLinks.simpleReportId, reportId))

    await db.insert(auditEvents).values({
      practiceId,
      userId: context.userId,
      clientId: report.clientId,
      eventType: "report.deleted",
      entityType: "simple_report",
      entityId: reportId,
    })
  } catch {
    return { error: "Unable to delete report. Please try again." }
  }

  revalidatePath(`/clients/${report.clientId}/reports`)
  revalidatePath(`/clients/${report.clientId}`)
  redirect(`/clients/${report.clientId}/reports`)
}
