import { and, asc, eq } from "drizzle-orm"

import {
  fundingApprovalTypeReports,
  fundingApprovalReportLinks,
  simpleReports,
} from "@/db/schema"
import { db } from "@/lib/db"
import {
  deriveReportingRequirementStatus,
  deriveReportingOverallStatus,
  type ReportingRequirementStatus,
} from "@/lib/funding/reporting-status"

export type ReportingRequirementRow = {
  reportRequirementId: string
  appointmentNumber: number
  reportTypeName: string
  linkedReportId: string | null
  status: ReportingRequirementStatus
}

export async function getReportingRequirementsForApproval(
  fundingApprovalId: string,
  fundingApprovalTypeId: string | null,
  appointmentsAttended: number
): Promise<ReportingRequirementRow[]> {
  if (!fundingApprovalTypeId) return []

  const rows = await db
    .select({
      reportRequirementId: fundingApprovalTypeReports.reportRequirementId,
      appointmentNumber: fundingApprovalTypeReports.appointmentNumber,
      reportType: fundingApprovalTypeReports.reportType,
      linkedSimpleReportId: fundingApprovalReportLinks.simpleReportId,
      linkedReportStatus: simpleReports.reportStatus,
    })
    .from(fundingApprovalTypeReports)
    .leftJoin(
      fundingApprovalReportLinks,
      and(
        eq(fundingApprovalReportLinks.fundingApprovalId, fundingApprovalId),
        eq(
          fundingApprovalReportLinks.appointmentNumber,
          fundingApprovalTypeReports.appointmentNumber
        )
      )
    )
    .leftJoin(
      simpleReports,
      eq(simpleReports.simpleReportId, fundingApprovalReportLinks.simpleReportId)
    )
    .where(
      eq(fundingApprovalTypeReports.fundingApprovalTypeId, fundingApprovalTypeId)
    )
    .orderBy(asc(fundingApprovalTypeReports.appointmentNumber))

  return rows.map((row) => {
    const isFulfilled = row.linkedReportStatus === "finalised"
    return {
      reportRequirementId: row.reportRequirementId,
      appointmentNumber: row.appointmentNumber,
      reportTypeName: row.reportType,
      linkedReportId: isFulfilled ? row.linkedSimpleReportId : null,
      status: deriveReportingRequirementStatus({
        hasLinkedReport: isFulfilled,
        appointmentNumber: row.appointmentNumber,
        appointmentsAttended,
      }),
    }
  })
}

export async function getReportingOverallStatusForApproval(
  fundingApprovalId: string,
  fundingApprovalTypeId: string | null,
  appointmentsAttended: number
) {
  const requirements = await getReportingRequirementsForApproval(
    fundingApprovalId,
    fundingApprovalTypeId,
    appointmentsAttended
  )
  if (requirements.length === 0) return null
  return deriveReportingOverallStatus(requirements.map((r) => r.status))
}
