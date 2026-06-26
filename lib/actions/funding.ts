"use server"

import { and, asc, count, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  appointments,
  claimTypes,
  claims,
  clients,
  fundingApprovalReportLinks,
  fundingApprovalTypeReports,
  fundingApprovalTypes,
  fundingApprovals,
  professionalOrganisationLinks,
  professionalOrganisations,
  professionals,
  simpleReports,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  formatApprovalDropdownLabel,
  formatApprovalProgress,
} from "@/lib/funding/format"
import {
  countActiveAppointmentsLinkedToClaim,
  countActiveFundingApprovalsByType,
  countActiveFundingApprovalsForClaim,
  countClaimsByType,
  logDeleteAuditEvent,
  performSoftDelete,
} from "@/lib/delete/delete-utils"

export type FundingFormState = {
  error?: string
  success?: boolean
  claimId?: string
  fundingApprovalId?: string
  fundingApprovalTypeId?: string
}

async function verifyPracticeId(practiceId: string) {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    throw new Error("Unauthorized practice access.")
  }
  return context
}

async function countAppointmentsAttended(fundingApprovalId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.fundingApprovalId, fundingApprovalId),
        eq(appointments.status, "completed")
      )
    )

  return Number(row?.total ?? 0)
}

export async function getClaimTypes(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select()
    .from(claimTypes)
    .where(
      and(eq(claimTypes.practiceId, practiceId), eq(claimTypes.isActive, true))
    )
    .orderBy(asc(claimTypes.claimTypeName))
}

export async function upsertClaimType(
  practiceId: string,
  claimTypeId: string | undefined,
  _prevState: unknown,
  formData: FormData
) {
  await verifyPracticeId(practiceId)

  const claimTypeName = String(formData.get("claim_type_name") ?? "").trim()
  if (!claimTypeName) {
    return { error: "Claim type name is required." }
  }

  const now = new Date()

  if (claimTypeId) {
    await db
      .update(claimTypes)
      .set({ claimTypeName, updatedAt: now })
      .where(
        and(
          eq(claimTypes.claimTypeId, claimTypeId),
          eq(claimTypes.practiceId, practiceId)
        )
      )
  } else {
    await db.insert(claimTypes).values({
      practiceId,
      claimTypeName,
      updatedAt: now,
    })
  }

  revalidatePath("/funding/claim-types")
  return { success: true as const }
}

export async function getFundingApprovalTypes(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select({
      fundingApprovalTypeId: fundingApprovalTypes.fundingApprovalTypeId,
      name: fundingApprovalTypes.name,
      claimTypeId: fundingApprovalTypes.claimTypeId,
      claimTypeName: claimTypes.claimTypeName,
      durationMonths: fundingApprovalTypes.durationMonths,
      appointmentsApproved: fundingApprovalTypes.appointmentsApproved,
    })
    .from(fundingApprovalTypes)
    .leftJoin(
      claimTypes,
      eq(fundingApprovalTypes.claimTypeId, claimTypes.claimTypeId)
    )
    .where(
      and(
        eq(fundingApprovalTypes.practiceId, practiceId),
        eq(fundingApprovalTypes.isActive, true)
      )
    )
    .orderBy(asc(fundingApprovalTypes.name))
}

export async function getFundingApprovalTypeById(
  practiceId: string,
  fundingApprovalTypeId: string
) {
  await verifyPracticeId(practiceId)

  const [type] = await db
    .select({
      fundingApprovalTypeId: fundingApprovalTypes.fundingApprovalTypeId,
      name: fundingApprovalTypes.name,
      claimTypeId: fundingApprovalTypes.claimTypeId,
      claimTypeName: claimTypes.claimTypeName,
      durationMonths: fundingApprovalTypes.durationMonths,
      appointmentsApproved: fundingApprovalTypes.appointmentsApproved,
    })
    .from(fundingApprovalTypes)
    .leftJoin(
      claimTypes,
      eq(fundingApprovalTypes.claimTypeId, claimTypes.claimTypeId)
    )
    .where(
      and(
        eq(
          fundingApprovalTypes.fundingApprovalTypeId,
          fundingApprovalTypeId
        ),
        eq(fundingApprovalTypes.practiceId, practiceId),
        eq(fundingApprovalTypes.isActive, true)
      )
    )
    .limit(1)

  if (!type) return null

  const reports = await db
    .select()
    .from(fundingApprovalTypeReports)
    .where(
      eq(
        fundingApprovalTypeReports.fundingApprovalTypeId,
        fundingApprovalTypeId
      )
    )
    .orderBy(asc(fundingApprovalTypeReports.appointmentNumber))

  return { ...type, reports }
}

export async function upsertFundingApprovalType(
  practiceId: string,
  fundingApprovalTypeId: string | undefined,
  _prevState: unknown,
  formData: FormData
) {
  await verifyPracticeId(practiceId)

  const name = String(formData.get("name") ?? "").trim()
  const claimTypeId =
    String(formData.get("claim_type_id") ?? "").trim() || null
  const durationRaw = String(formData.get("duration_months") ?? "").trim()
  const durationMonths =
    durationRaw === "" || durationRaw === "none" ? null : Number(durationRaw)
  const appointmentsApprovedRaw = String(
    formData.get("appointments_approved") ?? ""
  ).trim()
  const appointmentsApproved = appointmentsApprovedRaw
    ? Number(appointmentsApprovedRaw)
    : null
  const reportsRaw = String(formData.get("reporting_requirements") ?? "").trim()

  if (!name) {
    return { error: "Name is required." }
  }

  let reports: Array<{ appointmentNumber: number; reportType: string }> = []
  if (reportsRaw) {
    try {
      reports = JSON.parse(reportsRaw)
    } catch {
      return { error: "Invalid reporting requirements." }
    }
  }

  const now = new Date()
  let savedTypeId = fundingApprovalTypeId

  try {
    if (fundingApprovalTypeId) {
      await db
        .update(fundingApprovalTypes)
        .set({
          name,
          claimTypeId,
          durationMonths,
          appointmentsApproved,
          updatedAt: now,
        })
        .where(
          and(
            eq(
              fundingApprovalTypes.fundingApprovalTypeId,
              fundingApprovalTypeId
            ),
            eq(fundingApprovalTypes.practiceId, practiceId)
          )
        )
    } else {
      const [created] = await db
        .insert(fundingApprovalTypes)
        .values({
          practiceId,
          name,
          claimTypeId,
          durationMonths,
          appointmentsApproved,
          updatedAt: now,
        })
        .returning({
          fundingApprovalTypeId: fundingApprovalTypes.fundingApprovalTypeId,
        })
      savedTypeId = created.fundingApprovalTypeId
    }

    if (!savedTypeId) {
      return { error: "Unable to save funding approval type." }
    }

    await db
      .delete(fundingApprovalTypeReports)
      .where(
        eq(fundingApprovalTypeReports.fundingApprovalTypeId, savedTypeId)
      )

    if (reports.length > 0) {
      await db.insert(fundingApprovalTypeReports).values(
        reports.map((report) => ({
          fundingApprovalTypeId: savedTypeId!,
          appointmentNumber: report.appointmentNumber,
          reportType: report.reportType,
          updatedAt: now,
        }))
      )
    }
  } catch {
    return { error: "Unable to save funding approval type." }
  }

  revalidatePath("/funding/approval-types")
  revalidatePath(`/funding/approval-types/${savedTypeId}`)
  return { success: true, fundingApprovalTypeId: savedTypeId }
}

export async function getClaims(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select({
      claimId: claims.claimId,
      clientId: claims.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      claimTypeId: claims.claimTypeId,
      claimTypeName: claimTypes.claimTypeName,
      startDate: claims.startDate,
      endDate: claims.endDate,
    })
    .from(claims)
    .innerJoin(clients, eq(claims.clientId, clients.clientId))
    .innerJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .where(
      and(eq(claims.practiceId, practiceId), eq(claims.isActive, true))
    )
    .orderBy(desc(claims.startDate), asc(clients.lastName))
}

export async function getClaimsByClientId(clientId: string) {
  const context = await requirePractitionerContext()

  return db
    .select({
      claimId: claims.claimId,
      claimTypeName: claimTypes.claimTypeName,
      startDate: claims.startDate,
      endDate: claims.endDate,
    })
    .from(claims)
    .innerJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .where(
      and(
        eq(claims.clientId, clientId),
        eq(claims.practiceId, context.practiceId),
        eq(claims.isActive, true)
      )
    )
    .orderBy(desc(claims.startDate))
}

export async function getClaimById(claimId: string) {
  const context = await requirePractitionerContext()

  const [claim] = await db
    .select({
      claimId: claims.claimId,
      clientId: claims.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      claimTypeId: claims.claimTypeId,
      claimTypeName: claimTypes.claimTypeName,
      medicareCardNumber: claims.medicareCardNumber,
      medicareIrn: claims.medicareIrn,
      insuranceOrganisationId: claims.insuranceOrganisationId,
      insuranceOrganisationName: professionalOrganisations.organisationName,
      insuranceReferenceNumber: claims.insuranceReferenceNumber,
      startDate: claims.startDate,
      endDate: claims.endDate,
    })
    .from(claims)
    .innerJoin(clients, eq(claims.clientId, clients.clientId))
    .innerJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .leftJoin(
      professionalOrganisations,
      eq(claims.insuranceOrganisationId, professionalOrganisations.organisationId)
    )
    .where(
      and(
        eq(claims.claimId, claimId),
        eq(claims.practiceId, context.practiceId),
        eq(claims.isActive, true)
      )
    )
    .limit(1)

  if (!claim) return null

  const approvals = await getFundingApprovalsByClientId(claim.clientId)
  const claimApprovals = approvals.filter((item) => item.claimId === claimId)

  const reports = await db
    .selectDistinct({
      simpleReportId: simpleReports.simpleReportId,
      reportType: simpleReports.reportType,
      reportStatus: simpleReports.reportStatus,
      createdAt: simpleReports.createdAt,
    })
    .from(fundingApprovalReportLinks)
    .innerJoin(
      fundingApprovals,
      eq(
        fundingApprovalReportLinks.fundingApprovalId,
        fundingApprovals.fundingApprovalId
      )
    )
    .innerJoin(
      simpleReports,
      eq(fundingApprovalReportLinks.simpleReportId, simpleReports.simpleReportId)
    )
    .where(
      and(
        eq(fundingApprovals.claimId, claimId),
        eq(fundingApprovals.practiceId, context.practiceId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .orderBy(desc(simpleReports.createdAt))

  const linkedAppointments = await db
    .select({
      appointmentId: appointments.appointmentId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      location: appointments.location,
      status: appointments.status,
      fundingApprovalId: appointments.fundingApprovalId,
    })
    .from(appointments)
    .innerJoin(
      fundingApprovals,
      eq(appointments.fundingApprovalId, fundingApprovals.fundingApprovalId)
    )
    .where(
      and(
        eq(fundingApprovals.claimId, claimId),
        eq(fundingApprovals.practiceId, context.practiceId)
      )
    )
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))

  return {
    ...claim,
    fundingApprovals: claimApprovals,
    reports,
    linkedAppointments,
  }
}

export async function upsertClaim(
  claimId: string | undefined,
  _prevState: unknown,
  formData: FormData
) {
  const context = await requirePractitionerContext()

  let clientId = String(formData.get("client_id") ?? "").trim()
  const claimTypeId = String(formData.get("claim_type_id") ?? "").trim()
  const medicareCardNumber =
    String(formData.get("medicare_card_number") ?? "").trim() || null
  const medicareIrn =
    String(formData.get("medicare_irn") ?? "").trim() || null
  const insuranceOrganisationId =
    String(formData.get("insurance_organisation_id") ?? "").trim() || null
  const insuranceReferenceNumber =
    String(formData.get("insurance_reference_number") ?? "").trim() || null
  const startDate = String(formData.get("start_date") ?? "").trim() || null
  const endDate = String(formData.get("end_date") ?? "").trim() || null

  if (!claimTypeId) {
    return { error: "Claim type is required." }
  }

  const now = new Date()
  let savedClaimId = claimId

  try {
    if (claimId) {
      if (!clientId) {
        const [existing] = await db
          .select({ clientId: claims.clientId })
          .from(claims)
          .where(
            and(
              eq(claims.claimId, claimId),
              eq(claims.practiceId, context.practiceId)
            )
          )
          .limit(1)
        if (!existing) {
          return { error: "Claim not found." }
        }
        clientId = existing.clientId
      }

      await db
        .update(claims)
        .set({
          claimTypeId,
          medicareCardNumber,
          medicareIrn,
          insuranceOrganisationId,
          insuranceReferenceNumber,
          startDate,
          endDate,
          updatedAt: now,
        })
        .where(
          and(
            eq(claims.claimId, claimId),
            eq(claims.practiceId, context.practiceId)
          )
        )
    } else {
      if (!clientId) {
        return { error: "Client is required." }
      }

      const [created] = await db
        .insert(claims)
        .values({
          practiceId: context.practiceId,
          clientId,
          claimTypeId,
          medicareCardNumber,
          medicareIrn,
          insuranceOrganisationId,
          insuranceReferenceNumber,
          startDate,
          endDate,
          updatedAt: now,
        })
        .returning({ claimId: claims.claimId })
      savedClaimId = created.claimId
    }
  } catch {
    return { error: "Unable to save claim." }
  }

  revalidatePath("/funding/claims")
  revalidatePath(`/funding/claims/${savedClaimId}`)
  revalidatePath(`/clients/${clientId}`)
  return { success: true, claimId: savedClaimId }
}

export async function getFundingApprovals(practiceId: string) {
  await verifyPracticeId(practiceId)

  const rows = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      clientId: fundingApprovals.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      approvalTypeName: fundingApprovalTypes.name,
      startDate: fundingApprovals.startDate,
      endDate: fundingApprovals.endDate,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      approvalStatus: fundingApprovals.approvalStatus,
    })
    .from(fundingApprovals)
    .innerJoin(clients, eq(fundingApprovals.clientId, clients.clientId))
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .where(
      and(
        eq(fundingApprovals.practiceId, practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )
    .orderBy(desc(fundingApprovals.startDate), asc(clients.lastName))

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      appointmentsAttended: await countAppointmentsAttended(
        row.fundingApprovalId
      ),
    }))
  )
}

export async function getFundingApprovalsByClientId(clientId: string) {
  const context = await requirePractitionerContext()

  const rows = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      claimId: fundingApprovals.claimId,
      approvalTypeName: fundingApprovalTypes.name,
      startDate: fundingApprovals.startDate,
      endDate: fundingApprovals.endDate,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      approvalStatus: fundingApprovals.approvalStatus,
    })
    .from(fundingApprovals)
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .where(
      and(
        eq(fundingApprovals.clientId, clientId),
        eq(fundingApprovals.practiceId, context.practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )
    .orderBy(desc(fundingApprovals.startDate))

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      appointmentsAttended: await countAppointmentsAttended(
        row.fundingApprovalId
      ),
    }))
  )
}

export async function getClientFundingApprovalsForReport(
  clientId: string,
  practiceId: string
): Promise<
  Array<{
    fundingApprovalId: string
    label: string
    referrerId: string | null
    referrerName: string | null
    referrerTitle: string | null
    organisationName: string | null
    streetAddress: string | null
    postalAddress: string | null
    startDate: string | null
    appointmentsApproved: number | null
    appointmentsAttended: number
    requirements: Array<{
      reportRequirementId: string
      appointmentNumber: number
      reportType: string
      label: string
    }>
    appointments: Array<{
      appointmentId: string
      appointmentDate: string
      appointmentTime: string
      status: string
    }>
  }>
> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    return []
  }

  const rows = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      fundingApprovalTypeId: fundingApprovals.fundingApprovalTypeId,
      approvalTypeName: fundingApprovalTypes.name,
      startDate: fundingApprovals.startDate,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      referrerId: fundingApprovals.referrerId,
      referrerLastName: professionals.lastName,
      referrerTitle: professionals.title,
      organisationName: professionalOrganisations.organisationName,
      streetAddress: professionalOrganisations.streetAddress,
      postalAddress: professionalOrganisations.postalAddress,
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
    .leftJoin(
      professionalOrganisationLinks,
      and(
        eq(professionalOrganisationLinks.professionalId, professionals.professionalId),
        eq(professionalOrganisationLinks.isActive, true)
      )
    )
    .leftJoin(
      professionalOrganisations,
      eq(
        professionalOrganisationLinks.organisationId,
        professionalOrganisations.organisationId
      )
    )
    .where(
      and(
        eq(fundingApprovals.clientId, clientId),
        eq(fundingApprovals.practiceId, practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )
    .orderBy(desc(fundingApprovals.startDate))

  const byApprovalId = new Map<
    string,
    {
      fundingApprovalId: string
      fundingApprovalTypeId: string | null
      label: string
      referrerId: string | null
      referrerName: string | null
      referrerTitle: string | null
      organisationName: string | null
      streetAddress: string | null
      postalAddress: string | null
      startDate: string | null
      appointmentsApproved: number | null
    }
  >()

  for (const row of rows) {
    if (byApprovalId.has(row.fundingApprovalId)) {
      continue
    }

    const approvalTypeName = row.approvalTypeName?.trim() || "Funding approval"
    const referrerLabel = [row.referrerTitle, row.referrerLastName]
      .filter(Boolean)
      .join(" ")
      .trim()
    const label = referrerLabel
      ? `${approvalTypeName} — ${referrerLabel}`
      : approvalTypeName

    byApprovalId.set(row.fundingApprovalId, {
      fundingApprovalId: row.fundingApprovalId,
      fundingApprovalTypeId: row.fundingApprovalTypeId,
      label,
      referrerId: row.referrerId,
      referrerName: row.referrerLastName,
      referrerTitle: row.referrerTitle,
      organisationName: row.organisationName,
      streetAddress: row.streetAddress,
      postalAddress: row.postalAddress,
      startDate: row.startDate,
      appointmentsApproved: row.appointmentsApproved,
    })
  }

  return Promise.all(
    [...byApprovalId.values()].map(async (approval) => {
      let requirements: Array<{
        reportRequirementId: string
        appointmentNumber: number
        reportType: string
        label: string
      }> = []

      if (approval.fundingApprovalTypeId) {
        const requirementRows = await db
          .select({
            reportRequirementId: fundingApprovalTypeReports.reportRequirementId,
            appointmentNumber: fundingApprovalTypeReports.appointmentNumber,
            reportType: fundingApprovalTypeReports.reportType,
            simpleReportId: fundingApprovalReportLinks.simpleReportId,
          })
          .from(fundingApprovalTypeReports)
          .leftJoin(
            fundingApprovalReportLinks,
            and(
              eq(
                fundingApprovalReportLinks.fundingApprovalId,
                approval.fundingApprovalId
              ),
              eq(
                fundingApprovalReportLinks.appointmentNumber,
                fundingApprovalTypeReports.appointmentNumber
              )
            )
          )
          .where(
            eq(
              fundingApprovalTypeReports.fundingApprovalTypeId,
              approval.fundingApprovalTypeId
            )
          )
          .orderBy(asc(fundingApprovalTypeReports.appointmentNumber))

        requirements = requirementRows
          .filter((r) => !r.simpleReportId)
          .map((r) => ({
            reportRequirementId: r.reportRequirementId,
            appointmentNumber: r.appointmentNumber,
            reportType: r.reportType,
            label: `Report at appointment ${r.appointmentNumber}`,
          }))
      }

      const { fundingApprovalTypeId: _typeId, ...rest } = approval

      const apptRows = await db
        .select({
          appointmentId: appointments.appointmentId,
          appointmentDate: appointments.appointmentDate,
          appointmentTime: appointments.appointmentTime,
          status: appointments.status,
        })
        .from(appointments)
        .where(eq(appointments.fundingApprovalId, approval.fundingApprovalId))
        .orderBy(
          asc(appointments.appointmentDate),
          asc(appointments.appointmentTime)
        )

      return {
        ...rest,
        appointmentsAttended: await countAppointmentsAttended(
          approval.fundingApprovalId
        ),
        requirements,
        appointments: apptRows,
      }
    })
  )
}

export async function getFundingPanelByClientId(clientId: string) {
  const context = await requirePractitionerContext()

  const rows = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      claimTypeName: claimTypes.claimTypeName,
      approvalTypeName: fundingApprovalTypes.name,
      startDate: fundingApprovals.startDate,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
    })
    .from(fundingApprovals)
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .leftJoin(claims, eq(fundingApprovals.claimId, claims.claimId))
    .leftJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .where(
      and(
        eq(fundingApprovals.clientId, clientId),
        eq(fundingApprovals.practiceId, context.practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )
    .orderBy(desc(fundingApprovals.startDate))

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      appointmentsAttended: await countAppointmentsAttended(
        row.fundingApprovalId
      ),
    }))
  )
}

export async function getFundingApprovalById(fundingApprovalId: string) {
  const context = await requirePractitionerContext()

  const [approval] = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      clientId: fundingApprovals.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      claimId: fundingApprovals.claimId,
      fundingApprovalTypeId: fundingApprovals.fundingApprovalTypeId,
      approvalTypeName: fundingApprovalTypes.name,
      referrerId: fundingApprovals.referrerId,
      referrerFirstName: professionals.firstName,
      referrerLastName: professionals.lastName,
      startDate: fundingApprovals.startDate,
      endDate: fundingApprovals.endDate,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      approvalStatus: fundingApprovals.approvalStatus,
      claimTypeName: claimTypes.claimTypeName,
      medicareCardNumber: claims.medicareCardNumber,
      medicareIrn: claims.medicareIrn,
      insuranceOrganisationId: claims.insuranceOrganisationId,
      insuranceReferenceNumber: claims.insuranceReferenceNumber,
    })
    .from(fundingApprovals)
    .innerJoin(clients, eq(fundingApprovals.clientId, clients.clientId))
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
    .leftJoin(claims, eq(fundingApprovals.claimId, claims.claimId))
    .leftJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .where(
      and(
        eq(fundingApprovals.fundingApprovalId, fundingApprovalId),
        eq(fundingApprovals.practiceId, context.practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )
    .limit(1)

  if (!approval) return null

  let referrerOrganisationName: string | null = null
  if (approval.referrerId) {
    const [referrerOrg] = await db
      .select({ organisationName: professionalOrganisations.organisationName })
      .from(professionalOrganisationLinks)
      .innerJoin(
        professionalOrganisations,
        eq(
          professionalOrganisationLinks.organisationId,
          professionalOrganisations.organisationId
        )
      )
      .where(
        and(
          eq(professionalOrganisationLinks.professionalId, approval.referrerId),
          eq(professionalOrganisationLinks.isActive, true)
        )
      )
      .limit(1)
    referrerOrganisationName = referrerOrg?.organisationName ?? null
  }

  let insuranceOrganisationName: string | null = null
  if (approval.insuranceOrganisationId) {
    const [insuranceOrg] = await db
      .select({ organisationName: professionalOrganisations.organisationName })
      .from(professionalOrganisations)
      .where(
        eq(
          professionalOrganisations.organisationId,
          approval.insuranceOrganisationId
        )
      )
      .limit(1)
    insuranceOrganisationName = insuranceOrg?.organisationName ?? null
  }

  const appointmentsAttended = await countAppointmentsAttended(fundingApprovalId)

  const linkedAppointments = await db
    .select({
      appointmentId: appointments.appointmentId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      location: appointments.location,
      status: appointments.status,
    })
    .from(appointments)
    .where(eq(appointments.fundingApprovalId, fundingApprovalId))
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))

  const reportLinks = await db
    .select({
      linkId: fundingApprovalReportLinks.linkId,
      appointmentNumber: fundingApprovalReportLinks.appointmentNumber,
      reportType: fundingApprovalReportLinks.reportType,
      simpleReportId: fundingApprovalReportLinks.simpleReportId,
      reportStatus: simpleReports.reportStatus,
      createdAt: simpleReports.createdAt,
    })
    .from(fundingApprovalReportLinks)
    .leftJoin(
      simpleReports,
      eq(fundingApprovalReportLinks.simpleReportId, simpleReports.simpleReportId)
    )
    .where(eq(fundingApprovalReportLinks.fundingApprovalId, fundingApprovalId))
    .orderBy(desc(fundingApprovalReportLinks.appointmentNumber))

  const typeReports = approval.fundingApprovalTypeId
    ? await db
        .select()
        .from(fundingApprovalTypeReports)
        .where(
          eq(
            fundingApprovalTypeReports.fundingApprovalTypeId,
            approval.fundingApprovalTypeId
          )
        )
        .orderBy(asc(fundingApprovalTypeReports.appointmentNumber))
    : []

  const clientReports = await db
    .select({
      simpleReportId: simpleReports.simpleReportId,
      reportType: simpleReports.reportType,
      reportStatus: simpleReports.reportStatus,
      createdAt: simpleReports.createdAt,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.clientId, approval.clientId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .orderBy(desc(simpleReports.createdAt))

  return {
    ...approval,
    referrerOrganisationName,
    insuranceOrganisationName,
    appointmentsAttended,
    linkedAppointments,
    reportLinks,
    typeReports,
    clientReports,
  }
}

export async function upsertFundingApproval(
  fundingApprovalId: string | undefined,
  _prevState: unknown,
  formData: FormData
) {
  const context = await requirePractitionerContext()

  const clientId = String(formData.get("client_id") ?? "").trim()
  const fundingApprovalTypeId =
    String(formData.get("funding_approval_type_id") ?? "").trim() || null
  const claimId = String(formData.get("claim_id") ?? "").trim() || null
  const referrerId = String(formData.get("referrer_id") ?? "").trim() || null
  const startDate = String(formData.get("start_date") ?? "").trim() || null
  const endDate = String(formData.get("end_date") ?? "").trim() || null
  const appointmentsApprovedRaw = String(
    formData.get("appointments_approved") ?? ""
  ).trim()
  const appointmentsApproved = appointmentsApprovedRaw
    ? Number(appointmentsApprovedRaw)
    : null
  const approvalStatus =
    String(formData.get("approval_status") ?? "active").trim() || "active"
  const reportLinksRaw = String(formData.get("report_links") ?? "").trim()

  if (!clientId) {
    return { error: "Client is required." }
  }

  let reportLinks: Array<{
    appointmentNumber: number
    reportType: string
    simpleReportId: string | null
  }> = []

  if (reportLinksRaw) {
    try {
      reportLinks = JSON.parse(reportLinksRaw)
    } catch {
      return { error: "Invalid report links." }
    }
  }

  const now = new Date()
  let savedApprovalId = fundingApprovalId

  try {
    if (fundingApprovalId) {
      await db
        .update(fundingApprovals)
        .set({
          fundingApprovalTypeId,
          claimId,
          referrerId,
          startDate,
          endDate,
          appointmentsApproved,
          approvalStatus,
          updatedAt: now,
        })
        .where(
          and(
            eq(fundingApprovals.fundingApprovalId, fundingApprovalId),
            eq(fundingApprovals.practiceId, context.practiceId)
          )
        )
    } else {
      const [created] = await db
        .insert(fundingApprovals)
        .values({
          practiceId: context.practiceId,
          clientId,
          fundingApprovalTypeId,
          claimId,
          referrerId,
          startDate,
          endDate,
          appointmentsApproved,
          approvalStatus,
          updatedAt: now,
        })
        .returning({
          fundingApprovalId: fundingApprovals.fundingApprovalId,
        })
      savedApprovalId = created.fundingApprovalId
    }

    if (!savedApprovalId) {
      return { error: "Unable to save funding approval." }
    }

    await db
      .delete(fundingApprovalReportLinks)
      .where(eq(fundingApprovalReportLinks.fundingApprovalId, savedApprovalId))

    if (reportLinks.length > 0) {
      await db.insert(fundingApprovalReportLinks).values(
        reportLinks.map((link) => ({
          fundingApprovalId: savedApprovalId!,
          appointmentNumber: link.appointmentNumber,
          reportType: link.reportType,
          simpleReportId: link.simpleReportId,
          updatedAt: now,
        }))
      )
    }
  } catch {
    return { error: "Unable to save funding approval." }
  }

  revalidatePath("/funding/approvals")
  revalidatePath(`/funding/approvals/${savedApprovalId}`)
  revalidatePath(`/clients/${clientId}`)
  return { success: true, fundingApprovalId: savedApprovalId }
}

export async function getFundingApprovalsForDropdown(clientId: string) {
  const context = await requirePractitionerContext()

  const rows = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      approvalTypeName: fundingApprovalTypes.name,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      approvalStatus: fundingApprovals.approvalStatus,
      claimTypeId: claims.claimTypeId,
    })
    .from(fundingApprovals)
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .leftJoin(claims, eq(fundingApprovals.claimId, claims.claimId))
    .where(
      and(
        eq(fundingApprovals.clientId, clientId),
        eq(fundingApprovals.practiceId, context.practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )
    .orderBy(desc(fundingApprovals.startDate))

  return Promise.all(
    rows.map(async (row) => {
      const attended = await countAppointmentsAttended(row.fundingApprovalId)
      const typeName = row.approvalTypeName ?? "Funding approval"
      return {
        fundingApprovalId: row.fundingApprovalId,
        label: formatApprovalDropdownLabel(
          typeName,
          attended,
          row.appointmentsApproved
        ),
        approvalStatus: row.approvalStatus,
        claimTypeId: row.claimTypeId,
        isInactive:
          row.approvalStatus === "expired" ||
          row.approvalStatus === "exhausted",
      }
    })
  )
}

export async function getFundingApprovalTypesForForm(practiceId: string) {
  const types = await getFundingApprovalTypes(practiceId)

  return Promise.all(
    types.map(async (type) => {
      const detail = await getFundingApprovalTypeById(
        practiceId,
        type.fundingApprovalTypeId
      )
      return {
        fundingApprovalTypeId: type.fundingApprovalTypeId,
        name: type.name,
        claimTypeId: type.claimTypeId,
        durationMonths: type.durationMonths,
        appointmentsApproved: type.appointmentsApproved,
        reports: detail?.reports ?? [],
      }
    })
  )
}

export async function getClaimsForClientDropdown(
  clientId: string,
  claimTypeId?: string | null
) {
  const context = await requirePractitionerContext()

  const conditions = [
    eq(claims.clientId, clientId),
    eq(claims.practiceId, context.practiceId),
    eq(claims.isActive, true),
  ]

  if (claimTypeId) {
    conditions.push(eq(claims.claimTypeId, claimTypeId))
  }

  return db
    .select({
      claimId: claims.claimId,
      claimTypeId: claims.claimTypeId,
      claimTypeName: claimTypes.claimTypeName,
      startDate: claims.startDate,
      endDate: claims.endDate,
    })
    .from(claims)
    .innerJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .where(and(...conditions))
    .orderBy(desc(claims.startDate))
}

export async function getReferrersForDropdown(practiceId: string) {
  await verifyPracticeId(practiceId)

  const rows = await db
    .select({
      professionalId: professionals.professionalId,
      firstName: professionals.firstName,
      lastName: professionals.lastName,
      organisationName: professionalOrganisations.organisationName,
    })
    .from(professionals)
    .leftJoin(
      professionalOrganisationLinks,
      and(
        eq(
          professionalOrganisationLinks.professionalId,
          professionals.professionalId
        ),
        eq(professionalOrganisationLinks.isActive, true)
      )
    )
    .leftJoin(
      professionalOrganisations,
      eq(
        professionalOrganisationLinks.organisationId,
        professionalOrganisations.organisationId
      )
    )
    .where(
      and(
        eq(professionals.practiceId, practiceId),
        eq(professionals.isActive, true)
      )
    )
    .orderBy(asc(professionals.lastName), asc(professionals.firstName))

  const byProfessional = new Map<
    string,
    {
      professionalId: string
      firstName: string
      lastName: string
      organisationName: string | null
    }
  >()

  for (const row of rows) {
    if (!byProfessional.has(row.professionalId)) {
      byProfessional.set(row.professionalId, {
        professionalId: row.professionalId,
        firstName: row.firstName,
        lastName: row.lastName,
        organisationName: row.organisationName,
      })
    }
  }

  return Array.from(byProfessional.values())
}

export async function getClaimTypeDeleteStatus(
  practiceId: string,
  claimTypeId: string
) {
  await verifyPracticeId(practiceId)

  const [existing] = await db
    .select({ claimTypeId: claimTypes.claimTypeId })
    .from(claimTypes)
    .where(
      and(
        eq(claimTypes.claimTypeId, claimTypeId),
        eq(claimTypes.practiceId, practiceId),
        eq(claimTypes.isActive, true)
      )
    )
    .limit(1)

  if (!existing) {
    return { blockedReason: "Claim type not found." }
  }

  const claimCount = await countClaimsByType(claimTypeId, practiceId)
  if (claimCount > 0) {
    return {
      blockedReason: `Cannot delete: ${claimCount} active claims use this type.`,
    }
  }

  return {}
}

export async function deleteClaimType(
  claimTypeId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await verifyPracticeId(practiceId)
  const status = await getClaimTypeDeleteStatus(practiceId, claimTypeId)

  if (status.blockedReason) {
    return { blockedReason: status.blockedReason }
  }

  const result = await performSoftDelete({
    table: claimTypes,
    id: claimTypeId,
    idField: claimTypes.claimTypeId,
    practiceId,
    practiceIdField: claimTypes.practiceId,
  })

  if (!result.success) {
    return { error: result.error ?? "Unable to delete claim type." }
  }

  await logDeleteAuditEvent({
    practiceId,
    userId: context.userId,
    eventType: "claim_type.deleted",
    entityType: "claim_type",
    entityId: claimTypeId,
  })

  revalidatePath("/funding/claim-types")
  revalidatePath(`/funding/claim-types/${claimTypeId}`)
  redirect("/funding/claim-types")
}

export async function getFundingApprovalTypeDeleteStatus(
  practiceId: string,
  fundingApprovalTypeId: string
) {
  await verifyPracticeId(practiceId)

  const [existing] = await db
    .select({ fundingApprovalTypeId: fundingApprovalTypes.fundingApprovalTypeId })
    .from(fundingApprovalTypes)
    .where(
      and(
        eq(
          fundingApprovalTypes.fundingApprovalTypeId,
          fundingApprovalTypeId
        ),
        eq(fundingApprovalTypes.practiceId, practiceId),
        eq(fundingApprovalTypes.isActive, true)
      )
    )
    .limit(1)

  if (!existing) {
    return { blockedReason: "Funding approval type not found." }
  }

  const approvalCount = await countActiveFundingApprovalsByType(
    fundingApprovalTypeId,
    practiceId
  )

  if (approvalCount > 0) {
    return {
      blockedReason: `Cannot delete: ${approvalCount} active funding approvals use this type.`,
    }
  }

  return {}
}

export async function deleteFundingApprovalType(
  fundingApprovalTypeId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await verifyPracticeId(practiceId)
  const status = await getFundingApprovalTypeDeleteStatus(
    practiceId,
    fundingApprovalTypeId
  )

  if (status.blockedReason) {
    return { blockedReason: status.blockedReason }
  }

  const result = await performSoftDelete({
    table: fundingApprovalTypes,
    id: fundingApprovalTypeId,
    idField: fundingApprovalTypes.fundingApprovalTypeId,
    practiceId,
    practiceIdField: fundingApprovalTypes.practiceId,
  })

  if (!result.success) {
    return {
      error: result.error ?? "Unable to delete funding approval type.",
    }
  }

  await logDeleteAuditEvent({
    practiceId,
    userId: context.userId,
    eventType: "funding_approval_type.deleted",
    entityType: "funding_approval_type",
    entityId: fundingApprovalTypeId,
  })

  revalidatePath("/funding/approval-types")
  revalidatePath(`/funding/approval-types/${fundingApprovalTypeId}`)
  redirect("/funding/approval-types")
}

export async function getClaimDeleteStatus(claimId: string, practiceId: string) {
  await verifyPracticeId(practiceId)

  const claim = await getClaimById(claimId)
  if (!claim) {
    return { blockedReason: "Claim not found." }
  }

  const approvalCount = await countActiveFundingApprovalsForClaim(
    claimId,
    practiceId
  )
  if (approvalCount > 0) {
    return {
      blockedReason: `Cannot delete: ${approvalCount} active funding approvals use this claim.`,
    }
  }

  const appointmentCount = await countActiveAppointmentsLinkedToClaim(
    claimId,
    practiceId
  )
  if (appointmentCount > 0) {
    return {
      blockedReason: `Cannot delete: ${appointmentCount} active appointments are linked to funding approvals using this claim.`,
    }
  }

  return {}
}

export async function deleteClaim(
  claimId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await verifyPracticeId(practiceId)
  const status = await getClaimDeleteStatus(claimId, practiceId)

  if (status.blockedReason) {
    return { blockedReason: status.blockedReason }
  }

  const claim = await getClaimById(claimId)

  if (!claim) {
    return { error: "Claim not found." }
  }

  const result = await performSoftDelete({
    table: claims,
    id: claimId,
    idField: claims.claimId,
    practiceId,
    practiceIdField: claims.practiceId,
  })

  if (!result.success) {
    return { error: result.error ?? "Unable to delete claim." }
  }

  await logDeleteAuditEvent({
    practiceId,
    userId: context.userId,
    clientId: claim.clientId,
    eventType: "claim.deleted",
    entityType: "claim",
    entityId: claimId,
  })

  revalidatePath("/funding/claims")
  revalidatePath(`/funding/claims/${claimId}`)
  redirect("/funding/claims")
}

export async function deleteFundingApproval(
  fundingApprovalId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await verifyPracticeId(practiceId)
  const approval = await getFundingApprovalById(fundingApprovalId)

  if (!approval) {
    return { error: "Funding approval not found." }
  }

  const result = await performSoftDelete({
    table: fundingApprovals,
    id: fundingApprovalId,
    idField: fundingApprovals.fundingApprovalId,
    practiceId,
    practiceIdField: fundingApprovals.practiceId,
  })

  if (!result.success) {
    return { error: result.error ?? "Unable to delete funding approval." }
  }

  await logDeleteAuditEvent({
    practiceId,
    userId: context.userId,
    clientId: approval.clientId,
    eventType: "funding_approval.deleted",
    entityType: "funding_approval",
    entityId: fundingApprovalId,
  })

  revalidatePath("/funding/approvals")
  revalidatePath(`/funding/approvals/${fundingApprovalId}`)
  redirect("/funding/approvals")
}
