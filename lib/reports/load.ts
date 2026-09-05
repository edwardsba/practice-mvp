import { and, eq, ne } from "drizzle-orm"

import {
  clients,
  fundingApprovals,
  fundingApprovalTypes,
  reportTypes,
  sageSrDiagnosticReports,
  simpleReports,
} from "@/db/schema"
import { db } from "@/lib/db"
import { formatDisplayDate } from "@/lib/funding/format"
import { formatReportType } from "@/lib/reports/snapshot"
import { REPORT_TEMPLATE_LABELS } from "@/lib/reports/templates"

/**
 * One row of the practice-wide reports list, regardless of which table it comes
 * from. simple_reports and sage_sr_diagnostic_reports are deliberately separate
 * tables; they are fetched separately and merged here the same way the client-level
 * reports page does, with client name fields added because this list spans every
 * client in the practice.
 */
export type ReportListRow = {
  id: string
  kind: "simple" | "sage_sr"
  clientId: string
  clientFirstName: string
  clientLastName: string
  reportTypeLabel: string
  reportStatus: string
  reportDate: string | null
  createdAt: Date
  fundingApprovalLabel: string
}

export async function loadReportsForPractice(
  practiceId: string
): Promise<ReportListRow[]> {
  const simpleReportRows = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      reportTypeName: reportTypes.name,
      reportDate: simpleReports.reportDate,
      reportStatus: simpleReports.reportStatus,
      createdAt: simpleReports.createdAt,
      clientId: simpleReports.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      fundingApprovalTypeName: fundingApprovalTypes.name,
      fundingApprovalStartDate: fundingApprovals.startDate,
    })
    .from(simpleReports)
    .innerJoin(clients, eq(simpleReports.clientId, clients.clientId))
    .leftJoin(
      reportTypes,
      eq(simpleReports.reportTypeId, reportTypes.reportTypeId)
    )
    .leftJoin(
      fundingApprovals,
      eq(simpleReports.fundingApprovalId, fundingApprovals.fundingApprovalId)
    )
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .where(
      and(
        eq(simpleReports.practiceId, practiceId),
        eq(simpleReports.isCurrentVersion, true),
        ne(simpleReports.reportStatus, "deleted")
      )
    )

  const sageSrReportRows = await db
    .select({
      sageSrDiagnosticReportId: sageSrDiagnosticReports.sageSrDiagnosticReportId,
      reportStatus: sageSrDiagnosticReports.reportStatus,
      reportDate: sageSrDiagnosticReports.reportDate,
      createdAt: sageSrDiagnosticReports.createdAt,
      clientId: sageSrDiagnosticReports.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(sageSrDiagnosticReports)
    .innerJoin(clients, eq(sageSrDiagnosticReports.clientId, clients.clientId))
    .where(
      and(
        eq(sageSrDiagnosticReports.practiceId, practiceId),
        eq(sageSrDiagnosticReports.isCurrentVersion, true)
      )
    )

  return [
    ...simpleReportRows.map((row): ReportListRow => {
      const fundingApprovalLabel = row.fundingApprovalTypeName
        ? `${row.fundingApprovalTypeName} - ${
            row.fundingApprovalStartDate
              ? formatDisplayDate(row.fundingApprovalStartDate)
              : "—"
          }`
        : "—"
      return {
        id: row.simpleReportId,
        kind: "simple",
        clientId: row.clientId,
        clientFirstName: row.clientFirstName,
        clientLastName: row.clientLastName,
        reportTypeLabel: formatReportType(row.reportTypeName),
        reportStatus: row.reportStatus,
        reportDate: row.reportDate,
        createdAt: row.createdAt,
        fundingApprovalLabel,
      }
    }),
    ...sageSrReportRows.map(
      (row): ReportListRow => ({
        id: row.sageSrDiagnosticReportId,
        kind: "sage_sr",
        clientId: row.clientId,
        clientFirstName: row.clientFirstName,
        clientLastName: row.clientLastName,
        reportTypeLabel: REPORT_TEMPLATE_LABELS.sage_sr_diagnostic,
        reportStatus: row.reportStatus,
        reportDate: row.reportDate,
        createdAt: row.createdAt,
        fundingApprovalLabel: "—",
      })
    ),
  ].sort((a, b) => {
    // Same merged-list sort as the client-level reports page: reportDate desc
    // (nulls last), then createdAt desc. Replaces the previous single-table
    // orderBy(desc(createdAt)).
    if (a.reportDate !== b.reportDate) {
      if (!a.reportDate) return 1
      if (!b.reportDate) return -1
      return a.reportDate < b.reportDate ? 1 : -1
    }
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}
