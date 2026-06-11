import { and, asc, count, desc, eq, gte, lte, lt, ne } from "drizzle-orm"

import {
  appointments,
  claimTypes,
  claims,
  clients,
  fundingApprovalTypes,
  fundingApprovals,
  professionals,
} from "@/db/schema"
import type { AppointmentFilter } from "@/lib/appointments/constants"
import { todayDateString } from "@/lib/appointments/format"
import { db } from "@/lib/db"

export type CalendarAppointment = {
  appointmentId: string
  clientId: string
  appointmentDate: string
  appointmentTime: string
  durationMinutes: number
  clientFirstName: string
  clientLastName: string
}

export async function loadAppointmentsForPractitionerInRange(
  practiceId: string,
  practitionerProfileId: string,
  startDate: string,
  endDate: string
): Promise<CalendarAppointment[]> {
  return db
    .select({
      appointmentId: appointments.appointmentId,
      clientId: appointments.clientId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      durationMinutes: appointments.durationMinutes,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .where(
      and(
        eq(appointments.practiceId, practiceId),
        eq(appointments.practitionerProfileId, practitionerProfileId),
        gte(appointments.appointmentDate, startDate),
        lte(appointments.appointmentDate, endDate)
      )
    )
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
}

export async function loadAppointmentsForPractice(
  practiceId: string,
  filter: AppointmentFilter = "upcoming"
) {
  const today = todayDateString()

  const conditions = [eq(appointments.practiceId, practiceId)]

  if (filter === "upcoming") {
    conditions.push(gte(appointments.appointmentDate, today))
  } else if (filter === "past") {
    conditions.push(lt(appointments.appointmentDate, today))
  }

  return db
    .select({
      appointmentId: appointments.appointmentId,
      clientId: appointments.clientId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      durationMinutes: appointments.durationMinutes,
      location: appointments.location,
      status: appointments.status,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .where(and(...conditions))
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
}

export async function loadAppointmentForPractice(
  appointmentId: string,
  practiceId: string
) {
  const [row] = await db
    .select({
      appointmentId: appointments.appointmentId,
      clientId: appointments.clientId,
      practiceId: appointments.practiceId,
      practitionerProfileId: appointments.practitionerProfileId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      durationMinutes: appointments.durationMinutes,
      location: appointments.location,
      mode: appointments.mode,
      fundingApprovalId: appointments.fundingApprovalId,
      status: appointments.status,
      notes: appointments.notes,
      reminderSentAt: appointments.reminderSentAt,
      preSessionBatterySentAt: appointments.preSessionBatterySentAt,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      approvalTypeName: fundingApprovalTypes.name,
      claimTypeName: claimTypes.claimTypeName,
      referrerFirstName: professionals.firstName,
      referrerLastName: professionals.lastName,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      approvalStatus: fundingApprovals.approvalStatus,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .leftJoin(
      fundingApprovals,
      eq(appointments.fundingApprovalId, fundingApprovals.fundingApprovalId)
    )
    .leftJoin(
      fundingApprovalTypes,
      eq(
        fundingApprovals.fundingApprovalTypeId,
        fundingApprovalTypes.fundingApprovalTypeId
      )
    )
    .leftJoin(claims, eq(fundingApprovals.claimId, claims.claimId))
    .leftJoin(claimTypes, eq(claims.claimTypeId, claimTypes.claimTypeId))
    .leftJoin(
      professionals,
      eq(fundingApprovals.referrerId, professionals.professionalId)
    )
    .where(
      and(
        eq(appointments.appointmentId, appointmentId),
        eq(appointments.practiceId, practiceId)
      )
    )
    .limit(1)

  if (!row) {
    return null
  }

  let appointmentsAttended: number | null = null
  if (row.fundingApprovalId) {
    const [attendedRow] = await db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.fundingApprovalId, row.fundingApprovalId),
          ne(appointments.status, "cancelled")
        )
      )
    appointmentsAttended = Number(attendedRow?.total ?? 0)
  }

  return {
    ...row,
    appointmentsAttended,
  }
}

export async function loadAppointmentsForClient(
  clientId: string,
  practiceId: string
) {
  return db
    .select({
      appointmentId: appointments.appointmentId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      mode: appointments.mode,
      status: appointments.status,
      approvalTypeName: fundingApprovalTypes.name,
    })
    .from(appointments)
    .leftJoin(
      fundingApprovals,
      eq(appointments.fundingApprovalId, fundingApprovals.fundingApprovalId)
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
        eq(appointments.clientId, clientId),
        eq(appointments.practiceId, practiceId)
      )
    )
    .orderBy(
      desc(appointments.appointmentDate),
      desc(appointments.appointmentTime)
    )
}

export async function loadNextAppointmentForClient(
  clientId: string,
  practiceId: string
) {
  const today = todayDateString()

  const [row] = await db
    .select({
      appointmentId: appointments.appointmentId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      location: appointments.location,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.practiceId, practiceId),
        gte(appointments.appointmentDate, today)
      )
    )
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
    .limit(1)

  return row ?? null
}
