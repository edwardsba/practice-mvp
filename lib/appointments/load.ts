import { and, asc, eq, gte, lt } from "drizzle-orm"

import { appointments, clients } from "@/db/schema"
import type { AppointmentFilter } from "@/lib/appointments/constants"
import { todayDateString } from "@/lib/appointments/format"
import { db } from "@/lib/db"

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
      status: appointments.status,
      notes: appointments.notes,
      reminderSentAt: appointments.reminderSentAt,
      preSessionBatterySentAt: appointments.preSessionBatterySentAt,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .where(
      and(
        eq(appointments.appointmentId, appointmentId),
        eq(appointments.practiceId, practiceId)
      )
    )
    .limit(1)

  return row ?? null
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
