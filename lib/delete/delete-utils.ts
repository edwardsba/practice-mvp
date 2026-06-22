import { and, count, eq, ne, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core"

import {
  appointments,
  auditEvents,
  claimTypes,
  claims,
  clients,
  crisisPlans,
  fundingApprovals,
  fundingApprovalTypes,
  professionalOrganisations,
  professionals,
  sessionNotes,
  simpleReports,
  treatmentPlans,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { APPOINTMENT_STATUSES } from "@/lib/appointments/constants"
import { APPROVAL_STATUSES } from "@/lib/funding/format"
import { SESSION_NOTE_STATUSES } from "@/lib/session-notes/constants"

export type DependencyCheckResult = {
  canDelete: boolean
  blockedReason?: string
  dependentCount?: number
}

const ACTIVE_APPOINTMENT_STATUSES = APPOINTMENT_STATUSES.filter(
  (status) => status !== "cancelled"
)

const ACTIVE_APPROVAL_STATUS = APPROVAL_STATUSES[0]

export async function performSoftDelete(params: {
  table: PgTable
  id: string
  idField: AnyPgColumn
  practiceId: string
  practiceIdField: AnyPgColumn
}): Promise<{ success: boolean; error?: string }> {
  try {
    const [existing] = await db
      .select({ id: params.idField })
      .from(params.table)
      .where(
        and(
          eq(params.idField, params.id),
          eq(params.practiceIdField, params.practiceId)
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: "Record not found." }
    }

    await db
      .update(params.table)
      .set({ isActive: false, updatedAt: new Date() } as Record<string, unknown>)
      .where(
        and(
          eq(params.idField, params.id),
          eq(params.practiceIdField, params.practiceId)
        )
      )

    return { success: true }
  } catch {
    return { success: false, error: "Unable to delete record. Please try again." }
  }
}

export async function logDeleteAuditEvent(params: {
  practiceId: string
  userId?: string | null
  clientId?: string | null
  eventType: string
  entityType: string
  entityId: string
  deletionReason?: string
}) {
  await db.insert(auditEvents).values({
    practiceId: params.practiceId,
    userId: params.userId ?? null,
    clientId: params.clientId ?? null,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    actorMetadataJson: params.deletionReason
      ? { deletionReason: params.deletionReason }
      : null,
  })
}

async function verifyPracticeAccess(practiceId: string) {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    throw new Error("Unauthorized practice access.")
  }
  return context
}

async function countWhere(
  table: PgTable,
  conditions: SQL[]
): Promise<number> {
  try {
    const [row] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...conditions))

    return Number(row?.total ?? 0)
  } catch {
    return 0
  }
}

export async function countActiveAppointments(
  clientId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    const [row] = await db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clientId, clientId),
          eq(appointments.practiceId, practiceId),
          sql`${appointments.status} != 'cancelled'`
        )
      )

    return Number(row?.total ?? 0)
  } catch {
    return 0
  }
}

export async function countNonFinalisedSessionNotes(
  clientId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(sessionNotes, [
      eq(sessionNotes.clientId, clientId),
      eq(sessionNotes.practiceId, practiceId),
      eq(sessionNotes.status, SESSION_NOTE_STATUSES[0]),
    ])
  } catch {
    return 0
  }
}

export async function countActiveFundingApprovalsForClient(
  clientId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(fundingApprovals, [
      eq(fundingApprovals.clientId, clientId),
      eq(fundingApprovals.practiceId, practiceId),
      eq(fundingApprovals.isActive, true),
      eq(fundingApprovals.approvalStatus, ACTIVE_APPROVAL_STATUS),
    ])
  } catch {
    return 0
  }
}

export async function countActiveFundingApprovalsForProfessional(
  professionalId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    const [row] = await db
      .select({ total: count() })
      .from(fundingApprovals)
      .innerJoin(claims, eq(fundingApprovals.claimId, claims.claimId))
      .innerJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
      .where(
        and(
          eq(fundingApprovals.referrerId, professionalId),
          eq(fundingApprovals.practiceId, practiceId),
          eq(fundingApprovals.isActive, true),
          eq(fundingApprovals.approvalStatus, ACTIVE_APPROVAL_STATUS),
          sql`lower(trim(${claimTypes.claimTypeName})) = 'medicare'`
        )
      )

    return Number(row?.total ?? 0)
  } catch {
    return 0
  }
}

export async function countActiveCrisisPlans(
  clientId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(crisisPlans, [
      eq(crisisPlans.clientId, clientId),
      eq(crisisPlans.practiceId, practiceId),
      eq(crisisPlans.isActive, true),
    ])
  } catch {
    return 0
  }
}

export async function countActiveTreatmentPlans(
  clientId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(treatmentPlans, [
      eq(treatmentPlans.clientId, clientId),
      eq(treatmentPlans.practiceId, practiceId),
      eq(treatmentPlans.isActive, true),
    ])
  } catch {
    return 0
  }
}

export async function countActiveClaims(
  clientId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(claims, [
      eq(claims.clientId, clientId),
      eq(claims.practiceId, practiceId),
      eq(claims.isActive, true),
    ])
  } catch {
    return 0
  }
}

export async function countActiveFundingApprovalsForClaim(
  claimId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(fundingApprovals, [
      eq(fundingApprovals.claimId, claimId),
      eq(fundingApprovals.practiceId, practiceId),
      eq(fundingApprovals.isActive, true),
    ])
  } catch {
    return 0
  }
}

export async function countActiveAppointmentsLinkedToClaim(
  claimId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    const [row] = await db
      .select({ total: count() })
      .from(appointments)
      .innerJoin(
        fundingApprovals,
        eq(appointments.fundingApprovalId, fundingApprovals.fundingApprovalId)
      )
      .where(
        and(
          eq(fundingApprovals.claimId, claimId),
          eq(fundingApprovals.practiceId, practiceId),
          eq(fundingApprovals.isActive, true),
          eq(appointments.practiceId, practiceId),
          sql`${appointments.status} != 'cancelled'`
        )
      )

    return Number(row?.total ?? 0)
  } catch {
    return 0
  }
}

export async function countSimpleReports(
  clientId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(simpleReports, [
      eq(simpleReports.clientId, clientId),
      eq(simpleReports.practiceId, practiceId),
      ne(simpleReports.reportStatus, "deleted"),
    ])
  } catch {
    return 0
  }
}

export async function countClaimsByOrganisation(
  organisationId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(claims, [
      eq(claims.insuranceOrganisationId, organisationId),
      eq(claims.practiceId, practiceId),
      eq(claims.isActive, true),
    ])
  } catch {
    return 0
  }
}

export async function countClaimsByType(
  claimTypeId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(claims, [
      eq(claims.claimTypeId, claimTypeId),
      eq(claims.practiceId, practiceId),
      eq(claims.isActive, true),
    ])
  } catch {
    return 0
  }
}

export async function countNonFinalisedSessionNotesByAppointment(
  appointmentId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(sessionNotes, [
      eq(sessionNotes.appointmentId, appointmentId),
      eq(sessionNotes.practiceId, practiceId),
      eq(sessionNotes.status, SESSION_NOTE_STATUSES[0]),
    ])
  } catch {
    return 0
  }
}

export async function countActiveAppointmentsByType(
  appointmentTypeId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    const [row] = await db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.appointmentTypeId, appointmentTypeId),
          eq(appointments.practiceId, practiceId),
          sql`${appointments.status} != 'cancelled'`
        )
      )

    return Number(row?.total ?? 0)
  } catch {
    return 0
  }
}

export async function countActiveFundingApprovalsByType(
  fundingApprovalTypeId: string,
  practiceId: string
): Promise<number> {
  try {
    await verifyPracticeAccess(practiceId)

    return countWhere(fundingApprovals, [
      eq(fundingApprovals.fundingApprovalTypeId, fundingApprovalTypeId),
      eq(fundingApprovals.practiceId, practiceId),
      eq(fundingApprovals.isActive, true),
      eq(fundingApprovals.approvalStatus, ACTIVE_APPROVAL_STATUS),
    ])
  } catch {
    return 0
  }
}

export async function verifyClientInPractice(
  clientId: string,
  practiceId: string
): Promise<boolean> {
  try {
    await verifyPracticeAccess(practiceId)

    const [row] = await db
      .select({ clientId: clients.clientId })
      .from(clients)
      .where(
        and(
          eq(clients.clientId, clientId),
          eq(clients.practiceId, practiceId),
          eq(clients.isActive, true)
        )
      )
      .limit(1)

    return Boolean(row)
  } catch {
    return false
  }
}

export async function verifyProfessionalInPractice(
  professionalId: string,
  practiceId: string
): Promise<boolean> {
  try {
    await verifyPracticeAccess(practiceId)

    const [row] = await db
      .select({ professionalId: professionals.professionalId })
      .from(professionals)
      .where(
        and(
          eq(professionals.professionalId, professionalId),
          eq(professionals.practiceId, practiceId),
          eq(professionals.isActive, true)
        )
      )
      .limit(1)

    return Boolean(row)
  } catch {
    return false
  }
}

export async function verifyOrganisationInPractice(
  organisationId: string,
  practiceId: string
): Promise<boolean> {
  try {
    await verifyPracticeAccess(practiceId)

    const [row] = await db
      .select({ organisationId: professionalOrganisations.organisationId })
      .from(professionalOrganisations)
      .where(
        and(
          eq(professionalOrganisations.organisationId, organisationId),
          eq(professionalOrganisations.practiceId, practiceId),
          eq(professionalOrganisations.isActive, true)
        )
      )
      .limit(1)

    return Boolean(row)
  } catch {
    return false
  }
}

export { ACTIVE_APPOINTMENT_STATUSES }
