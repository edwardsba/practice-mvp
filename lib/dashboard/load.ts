import { and, asc, eq, sql } from "drizzle-orm"

import { appointments, clients, practices } from "@/db/schema"
import { db } from "@/lib/db"
import { todayDateString } from "@/lib/dates/practice-time"

export async function loadTodaysAppointments(practiceId: string) {
  const today = todayDateString()

  return db
    .select({
      appointmentId: appointments.appointmentId,
      clientId: appointments.clientId,
      appointmentTime: appointments.appointmentTime,
      durationMinutes: appointments.durationMinutes,
      location: appointments.location,
      mode: appointments.mode,
      status: appointments.status,
      practiceLocationNickname: practices.locationNickname,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.clientId))
    .leftJoin(practices, eq(appointments.practiceId, practices.practiceId))
    .where(
      and(
        eq(appointments.practiceId, practiceId),
        eq(appointments.appointmentDate, today)
      )
    )
    .orderBy(asc(appointments.appointmentTime))
}

/**
 * Count of reporting requirements that are overdue right now, across every
 * active funding approval in the practice. Matches the same definition
 * used by deriveReportingRequirementStatus (lib/funding/reporting-status.ts):
 * a requirement is overdue when its trigger appointment has been reached
 * (appointmentsAttended >= appointmentNumber) and no finalised report is
 * linked to it. Computed as one query rather than looping per-approval.
 */
export async function countOutstandingReports(
  practiceId: string
): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT count(*) AS count
    FROM funding_approval_type_reports fatr
    JOIN funding_approvals fa
      ON fa.funding_approval_type_id = fatr.funding_approval_type_id
      AND fa.is_active = true
      AND fa.practice_id = ${practiceId}
    LEFT JOIN funding_approval_report_links link
      ON link.funding_approval_id = fa.funding_approval_id
      AND link.appointment_number = fatr.appointment_number
    LEFT JOIN simple_reports sr
      ON sr.simple_report_id = link.simple_report_id
      AND sr.report_status = 'finalised'
    WHERE sr.simple_report_id IS NULL
      AND (
        SELECT count(*) FROM appointments a
        WHERE a.funding_approval_id = fa.funding_approval_id
          AND a.status = 'completed'
      ) >= fatr.appointment_number
  `)

  return Number(result.rows[0]?.count ?? 0)
}

/**
 * Count of completed appointments that don't have a finalised, active
 * session note attached — covers both "no note was ever started" and
 * "note exists but is still a draft."
 */
export async function countAppointmentsMissingFinalisedNote(
  practiceId: string
): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT count(*) AS count
    FROM appointments a
    WHERE a.practice_id = ${practiceId}
      AND a.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM session_notes sn
        WHERE sn.appointment_id = a.appointment_id
          AND sn.is_active = true
          AND sn.status = 'finalised'
      )
  `)

  return Number(result.rows[0]?.count ?? 0)
}
