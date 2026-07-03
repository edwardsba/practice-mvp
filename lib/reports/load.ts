import { and, desc, eq, ne } from "drizzle-orm"

import {
  clients,
  fundingApprovals,
  fundingApprovalTypes,
  reportTypes,
  simpleReports,
} from "@/db/schema"
import { db } from "@/lib/db"

export async function loadReportsForPractice(practiceId: string) {
  const rows = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      reportType: simpleReports.reportType,
      reportTypeName: reportTypes.name,
      reportDate: simpleReports.reportDate,
      reportStatus: simpleReports.reportStatus,
      dateRangeStart: simpleReports.dateRangeStart,
      dateRangeEnd: simpleReports.dateRangeEnd,
      recipientType: simpleReports.recipientType,
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
        ne(simpleReports.reportStatus, "deleted")
      )
    )
    .orderBy(desc(simpleReports.createdAt))

  return rows
}

export type ReportListRow = Awaited<
  ReturnType<typeof loadReportsForPractice>
>[number]
