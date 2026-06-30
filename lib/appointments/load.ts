import { and, asc, count, desc, eq, gte, lte, lt } from "drizzle-orm"

import {
  appointments,
  appointmentTypeFees,
  appointmentTypes,
  claimTypes,
  claims,
  clients,
  fundingApprovalTypes,
  fundingApprovals,
  practices,
  practitionerPracticeMemberships,
  professionals,
  sessionNotes,
} from "@/db/schema"
import type { AppointmentFilter } from "@/lib/appointments/constants"
import {
  calculateAttendanceRisk,
  type AttendanceRisk,
} from "@/lib/appointments/attendance-score"
import { pickCurrentFee } from "@/lib/appointment-types/format"
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
      mode: appointments.mode,
      status: appointments.status,
      sessionNoteStatus: sessionNotes.status,
      practiceName: practices.practiceName,
      practiceAddress: practices.address,
      practiceLocationNickname: practices.locationNickname,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .leftJoin(practices, eq(appointments.practiceId, practices.practiceId))
    .leftJoin(
      sessionNotes,
      eq(sessionNotes.appointmentId, appointments.appointmentId)
    )
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
      appointmentTypeId: appointments.appointmentTypeId,
      membershipId: appointments.membershipId,
      status: appointments.status,
      cancelledAt: appointments.cancelledAt,
      cancellationSource: appointments.cancellationSource,
      notes: appointments.notes,
      reminderSentAt: appointments.reminderSentAt,
      preSessionBatterySentAt: appointments.preSessionBatterySentAt,
      postSessionSentAt: appointments.postSessionSentAt,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      approvalTypeName: fundingApprovalTypes.name,
      claimTypeName: claimTypes.claimTypeName,
      referrerFirstName: professionals.firstName,
      referrerLastName: professionals.lastName,
      appointmentsApproved: fundingApprovals.appointmentsApproved,
      approvalStatus: fundingApprovals.approvalStatus,
      fundingApprovalStartDate: fundingApprovals.startDate,
      appointmentTypeNickname: appointmentTypes.nickname,
      appointmentTypeReferenceNumber: appointmentTypes.referenceNumber,
      practiceName: practices.practiceName,
      practiceAddress: practices.address,
      practiceLocationNickname: practices.locationNickname,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .leftJoin(
      appointmentTypes,
      eq(appointments.appointmentTypeId, appointmentTypes.appointmentTypeId)
    )
    .leftJoin(
      practitionerPracticeMemberships,
      eq(appointments.membershipId, practitionerPracticeMemberships.membershipId)
    )
    .leftJoin(
      practices,
      eq(appointments.practiceId, practices.practiceId)
    )
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

  let appointmentTypeFee: string | null = null
  let appointmentTypeTax: string | null = null
  let appointmentTypeTotal: string | null = null
  let appointmentTypeFeeStartDate: string | null = null

  if (row.appointmentTypeId) {
    const fees = await db
      .select({
        fee: appointmentTypeFees.fee,
        tax: appointmentTypeFees.tax,
        total: appointmentTypeFees.total,
        startDate: appointmentTypeFees.startDate,
        endDate: appointmentTypeFees.endDate,
        status: appointmentTypeFees.status,
      })
      .from(appointmentTypeFees)
      .where(
        eq(appointmentTypeFees.appointmentTypeId, row.appointmentTypeId)
      )

    const currentFee = pickCurrentFee(fees, todayDateString())
    if (currentFee) {
      appointmentTypeFee = currentFee.fee
      appointmentTypeTax = currentFee.tax
      appointmentTypeTotal = currentFee.total
      appointmentTypeFeeStartDate = currentFee.startDate
    }
  }

  let appointmentsAttended: number | null = null
  if (row.fundingApprovalId) {
    const [attendedRow] = await db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.fundingApprovalId, row.fundingApprovalId),
          eq(appointments.status, "completed")
        )
      )
    appointmentsAttended = Number(attendedRow?.total ?? 0)
  }

  return {
    ...row,
    appointmentTypeFee,
    appointmentTypeTax,
    appointmentTypeTotal,
    appointmentTypeFeeStartDate,
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
      sessionNoteStatus: sessionNotes.status,
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
    .leftJoin(
      sessionNotes,
      eq(sessionNotes.appointmentId, appointments.appointmentId)
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

export async function loadAttendanceRiskForClient(
  clientId: string,
  practiceId: string
): Promise<AttendanceRisk> {
  const rows = await db
    .select({
      status: appointments.status,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      cancelledAt: appointments.cancelledAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.practiceId, practiceId)
      )
    )

  return calculateAttendanceRisk(
    rows.map((row) => ({
      status: row.status,
      appointmentDate: row.appointmentDate,
      appointmentTime: row.appointmentTime,
      cancelledAt: row.cancelledAt,
    }))
  )
}
