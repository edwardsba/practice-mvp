import { eq } from "drizzle-orm"

import {
  auditEvents,
  fundingApprovalReportLinks,
  simpleReports,
} from "@/db/schema"
import { db } from "@/lib/db"
import type { ReportSnapshot } from "@/lib/reports/snapshot"

type ReportRowValues = {
  reportType: string
  reportTypeId: string | null
  reportDate: string
  dateRangeStart: string
  dateRangeEnd: string
  snapshot: ReportSnapshot
  clinicalSummaryText: string | null
  recommendationsText: string | null
  recipientType: string | null
  fundingApprovalId: string | null
  reportRequirementId: string | null
}

export async function commitReportDraft({
  clientId,
  practiceId,
  practitionerProfileId,
  userId,
  existingDraftReportId,
  previousVersionId,
  values,
}: {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  userId: string
  existingDraftReportId: string | null
  previousVersionId: string | null
  values: ReportRowValues
}): Promise<{ simpleReportId: string }> {
  const now = new Date()

  if (existingDraftReportId) {
    await db
      .update(simpleReports)
      .set({
        reportType: values.reportType,
        reportTypeId: values.reportTypeId,
        reportDate: values.reportDate,
        dateRangeStart: values.dateRangeStart,
        dateRangeEnd: values.dateRangeEnd,
        valuesSnapshotJson: values.snapshot,
        clinicalSummaryText: values.clinicalSummaryText,
        recommendationsText: values.recommendationsText,
        recipientType: values.recipientType,
        fundingApprovalId: values.fundingApprovalId,
        reportRequirementId: values.reportRequirementId,
        updatedAt: now,
      })
      .where(eq(simpleReports.simpleReportId, existingDraftReportId))

    return { simpleReportId: existingDraftReportId }
  }

  let versionNumber = 1
  if (previousVersionId) {
    const [previous] = await db
      .select({ versionNumber: simpleReports.versionNumber })
      .from(simpleReports)
      .where(eq(simpleReports.simpleReportId, previousVersionId))
      .limit(1)
    versionNumber = (previous?.versionNumber ?? 0) + 1
  }

  let newReportId!: string

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(simpleReports)
      .values({
        clientId,
        practiceId,
        practitionerProfileId,
        reportType: values.reportType,
        reportTypeId: values.reportTypeId,
        reportDate: values.reportDate,
        dateRangeStart: values.dateRangeStart,
        dateRangeEnd: values.dateRangeEnd,
        valuesSnapshotJson: values.snapshot,
        clinicalSummaryText: values.clinicalSummaryText,
        recommendationsText: values.recommendationsText,
        reportStatus: "draft",
        recipientType: values.recipientType,
        fundingApprovalId: values.fundingApprovalId,
        reportRequirementId: values.reportRequirementId,
        versionNumber,
        isCurrentVersion: !previousVersionId,
        previousVersionId,
      })
      .returning({ simpleReportId: simpleReports.simpleReportId })

    newReportId = inserted.simpleReportId

    await tx.insert(auditEvents).values({
      practiceId,
      userId,
      clientId,
      eventType: "report.created",
      entityType: "simple_report",
      entityId: inserted.simpleReportId,
    })
  })

  return { simpleReportId: newReportId }
}

export async function commitReportFinalise({
  clientId,
  practiceId,
  practitionerProfileId,
  userId,
  existingDraftReportId,
  previousVersionId,
  values,
}: {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  userId: string
  existingDraftReportId: string | null
  previousVersionId: string | null
  values: ReportRowValues
}): Promise<{ simpleReportId: string }> {
  const now = new Date()
  let versionNumber = 1

  if (previousVersionId) {
    const [previous] = await db
      .select({ versionNumber: simpleReports.versionNumber })
      .from(simpleReports)
      .where(eq(simpleReports.simpleReportId, previousVersionId))
      .limit(1)
    versionNumber = (previous?.versionNumber ?? 0) + 1
  }

  let reportId: string

  await db.transaction(async (tx) => {
    if (existingDraftReportId) {
      await tx
        .update(simpleReports)
        .set({
          reportType: values.reportType,
          reportTypeId: values.reportTypeId,
          reportDate: values.reportDate,
          dateRangeStart: values.dateRangeStart,
          dateRangeEnd: values.dateRangeEnd,
          valuesSnapshotJson: values.snapshot,
          clinicalSummaryText: values.clinicalSummaryText,
          recommendationsText: values.recommendationsText,
          recipientType: values.recipientType,
          fundingApprovalId: values.fundingApprovalId,
          reportRequirementId: values.reportRequirementId,
          reportStatus: "finalised",
          finalisedAt: now,
          isCurrentVersion: true,
          updatedAt: now,
        })
        .where(eq(simpleReports.simpleReportId, existingDraftReportId))

      reportId = existingDraftReportId

      await tx.insert(auditEvents).values({
        practiceId,
        userId,
        clientId,
        eventType: "report.finalised",
        entityType: "simple_report",
        entityId: existingDraftReportId,
      })
    } else {
      const [inserted] = await tx
        .insert(simpleReports)
        .values({
          clientId,
          practiceId,
          practitionerProfileId,
          reportType: values.reportType,
          reportTypeId: values.reportTypeId,
          reportDate: values.reportDate,
          dateRangeStart: values.dateRangeStart,
          dateRangeEnd: values.dateRangeEnd,
          valuesSnapshotJson: values.snapshot,
          clinicalSummaryText: values.clinicalSummaryText,
          recommendationsText: values.recommendationsText,
          reportStatus: "finalised",
          finalisedAt: now,
          recipientType: values.recipientType,
          fundingApprovalId: values.fundingApprovalId,
          reportRequirementId: values.reportRequirementId,
          versionNumber,
          isCurrentVersion: true,
          previousVersionId,
        })
        .returning({ simpleReportId: simpleReports.simpleReportId })

      reportId = inserted.simpleReportId

      await tx.insert(auditEvents).values({
        practiceId,
        userId,
        clientId,
        eventType: "report.created",
        entityType: "simple_report",
        entityId: inserted.simpleReportId,
      })

      await tx.insert(auditEvents).values({
        practiceId,
        userId,
        clientId,
        eventType: "report.finalised",
        entityType: "simple_report",
        entityId: inserted.simpleReportId,
      })
    }

    if (previousVersionId) {
      await tx
        .update(simpleReports)
        .set({ isCurrentVersion: false, updatedAt: now })
        .where(eq(simpleReports.simpleReportId, previousVersionId))

      await tx
        .update(fundingApprovalReportLinks)
        .set({ simpleReportId: reportId, updatedAt: now })
        .where(eq(fundingApprovalReportLinks.simpleReportId, previousVersionId))
    }
  })

  return { simpleReportId: reportId! }
}
