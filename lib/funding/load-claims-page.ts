import "server-only"

import { and, asc, desc, eq, inArray } from "drizzle-orm"

import {
  appointments,
  claimTypes,
  claims,
  clients,
  fundingApprovalTypes,
  fundingApprovals,
  professionalOrganisations,
  professionals,
  professions,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { todayDateString } from "@/lib/dates/practice-time"
import { formatDisplayDate } from "@/lib/funding/format"
import {
  buildClaimsPageModel,
  type ClaimsPageAppointmentInput,
  type ClaimsPageApprovalInput,
  type ClaimsPageClaimInput,
  type ClaimsPageModel,
} from "@/lib/funding/claims-page"
import { getReportingRequirementsForApproval } from "@/lib/funding/reporting-requirements"
import type { ReportingRequirementStatus } from "@/lib/funding/reporting-status"

async function countAppointmentsAttended(fundingApprovalId: string) {
  const rows = await db
    .select({ appointmentId: appointments.appointmentId })
    .from(appointments)
    .where(
      and(
        eq(appointments.fundingApprovalId, fundingApprovalId),
        eq(appointments.status, "completed")
      )
    )
  return rows.length
}

/**
 * Load the claims / referrals / funding page model for one client.
 * Includes active and inactive claims (is_active true/false).
 */
export async function loadClaimsPageForClient(
  clientId: string
): Promise<{ clientName: string; model: ClaimsPageModel } | null> {
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) return null

  const claimRows = await db
    .select({
      claimId: claims.claimId,
      claimTypeName: claimTypes.claimTypeName,
      isActive: claims.isActive,
      startDate: claims.startDate,
      endDate: claims.endDate,
      createdAt: claims.createdAt,
      medicareCardNumber: claims.medicareCardNumber,
      medicareIrn: claims.medicareIrn,
      insuranceOrganisationName: professionalOrganisations.organisationName,
      insuranceReferenceNumber: claims.insuranceReferenceNumber,
    })
    .from(claims)
    .innerJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .leftJoin(
      professionalOrganisations,
      eq(claims.insuranceOrganisationId, professionalOrganisations.organisationId)
    )
    .where(
      and(
        eq(claims.clientId, clientId),
        eq(claims.practiceId, context.practiceId)
      )
    )
    .orderBy(desc(claims.startDate), desc(claims.createdAt))

  const approvalRows = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      claimId: fundingApprovals.claimId,
      fundingApprovalTypeId: fundingApprovals.fundingApprovalTypeId,
      approvalTypeName: fundingApprovalTypes.name,
      startDate: fundingApprovals.startDate,
      endDate: fundingApprovals.endDate,
      referralDate: fundingApprovals.referralDate,
      createdAt: fundingApprovals.createdAt,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      approvalStatus: fundingApprovals.approvalStatus,
      referrerId: fundingApprovals.referrerId,
      referrerTitle: professionals.title,
      referrerFirstName: professionals.firstName,
      referrerLastName: professionals.lastName,
      referrerProfessionName: professions.professionName,
      referralSource: fundingApprovals.referralSource,
      referrerRelationshipId: fundingApprovals.referrerRelationshipId,
      referrerOther: fundingApprovals.referrerOther,
      referrerComments: fundingApprovals.referrerComments,
    })
    .from(fundingApprovals)
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .leftJoin(
      professionals,
      eq(fundingApprovals.referrerId, professionals.professionalId)
    )
    .leftJoin(professions, eq(professionals.professionId, professions.professionId))
    .where(
      and(
        eq(fundingApprovals.clientId, clientId),
        eq(fundingApprovals.practiceId, context.practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )
    .orderBy(desc(fundingApprovals.startDate), desc(fundingApprovals.createdAt))

  const approvals: ClaimsPageApprovalInput[] = await Promise.all(
    approvalRows.map(async (row) => {
      const appointmentsAttended = await countAppointmentsAttended(
        row.fundingApprovalId
      )

      let reportingRequirements: Array<{
        appointmentNumber: number
        reportType: string
        status: ReportingRequirementStatus
      }> = []

      if (row.fundingApprovalTypeId) {
        const reqs = await getReportingRequirementsForApproval(
          row.fundingApprovalId,
          row.fundingApprovalTypeId,
          appointmentsAttended
        )
        reportingRequirements = reqs.map((req) => ({
          appointmentNumber: req.appointmentNumber,
          reportType: req.reportTypeName,
          status: req.status,
        }))
      }

      return {
        fundingApprovalId: row.fundingApprovalId,
        claimId: row.claimId,
        fundingApprovalTypeId: row.fundingApprovalTypeId,
        approvalTypeName: row.approvalTypeName,
        startDate: row.startDate,
        endDate: row.endDate,
        referralDate: row.referralDate,
        createdAt: row.createdAt,
        appointmentsAttended,
        appointmentsApproved: row.appointmentsApproved,
        approvalStatus: row.approvalStatus,
        referrerId: row.referrerId,
        referrerTitle: row.referrerTitle,
        referrerFirstName: row.referrerFirstName,
        referrerLastName: row.referrerLastName,
        referrerProfessionName: row.referrerProfessionName,
        referralSource: row.referralSource,
        referrerRelationshipId: row.referrerRelationshipId,
        referrerOther: row.referrerOther,
        referrerComments: row.referrerComments,
        reportingRequirements,
      }
    })
  )

  const approvalIds = approvals.map((row) => row.fundingApprovalId)
  let appointmentRows: ClaimsPageAppointmentInput[] = []
  if (approvalIds.length > 0) {
    const rows = await db
      .select({
        fundingApprovalId: appointments.fundingApprovalId,
        appointmentDate: appointments.appointmentDate,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.practiceId, context.practiceId),
          eq(appointments.clientId, clientId),
          inArray(appointments.fundingApprovalId, approvalIds)
        )
      )
      .orderBy(asc(appointments.appointmentDate))

    appointmentRows = rows.map((row) => ({
      fundingApprovalId: row.fundingApprovalId,
      appointmentDate: String(row.appointmentDate),
      status: row.status,
    }))
  }

  const claimInputs: ClaimsPageClaimInput[] = claimRows.map((row) => ({
    claimId: row.claimId,
    claimTypeName: row.claimTypeName,
    isActive: row.isActive,
    startDate: row.startDate,
    endDate: row.endDate,
    createdAt: row.createdAt,
    medicareCardNumber: row.medicareCardNumber,
    medicareIrn: row.medicareIrn,
    insuranceOrganisationName: row.insuranceOrganisationName,
    insuranceReferenceNumber: row.insuranceReferenceNumber,
  }))

  const model = buildClaimsPageModel(
    claimInputs,
    approvals,
    appointmentRows,
    todayDateString(),
    formatDisplayDate
  )

  return {
    clientName: `${client.firstName} ${client.lastName}`,
    model,
  }
}
