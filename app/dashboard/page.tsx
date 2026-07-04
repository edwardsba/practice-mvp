import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { PsqStatusBadge } from "@/components/session-notes/psq-status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  formatAppointmentTime,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"
import { resolveAppointmentLocationText } from "@/lib/appointments/location"
import { requirePractitionerContext } from "@/lib/auth"
import { formatCalendarPeriodLabel } from "@/lib/calendar/dates"
import {
  countActiveClientsWithoutUpcomingAppointment,
  countAppointmentsMissingFinalisedNote,
  countOutstandingReports,
  loadTodaysAppointments,
} from "@/lib/dashboard/load"
import { todayDateString } from "@/lib/dates/practice-time"
import { APPOINTMENT_STATUS_CONFIG } from "@/lib/status"

export default async function DashboardPage() {
  const context = await requirePractitionerContext()

  const [
    todaysAppointments,
    outstandingReportsCount,
    missingNotesCount,
    clientsWithoutAppointmentCount,
  ] = await Promise.all([
    loadTodaysAppointments(context.practiceId),
    countOutstandingReports(context.practiceId),
    countAppointmentsMissingFinalisedNote(context.practiceId),
    countActiveClientsWithoutUpcomingAppointment(context.practiceId),
  ])

  return (
    <AppShell title="Welcome">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s appointments</CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatCalendarPeriodLabel("day", todayDateString())}
            </p>
          </CardHeader>
          <CardContent>
            {todaysAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No appointments scheduled today.
              </p>
            ) : (
              <ul className="divide-y">
                {todaysAppointments.map((appt) => {
                  const locationText =
                    appt.mode === "online"
                      ? "Online"
                      : resolveAppointmentLocationText(
                          appt.location,
                          appt.practiceLocationNickname,
                          appt.practiceAddress,
                          appt.practiceName
                        )

                  return (
                    <li key={appt.appointmentId} className="py-3">
                      <Link
                        href={`/appointments/${appt.appointmentId}`}
                        className="flex flex-col gap-1 hover:underline"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {formatAppointmentTime(appt.appointmentTime)} —{" "}
                            {formatClientNameLastFirst(
                              appt.clientFirstName,
                              appt.clientLastName
                            )}
                          </span>
                          <StatusBadge
                            status={appt.status}
                            statusMap={APPOINTMENT_STATUS_CONFIG}
                          />
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{locationText}</span>
                          <PsqStatusBadge
                            sentAt={appt.preSessionBatterySentAt}
                            psqBatteryStatus={appt.psqBatteryStatus}
                          />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Outstanding reports</CardTitle>
            </CardHeader>
            <CardContent>
              {outstandingReportsCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No outstanding reports.
                </p>
              ) : (
                <Link
                  href="/funding/approvals"
                  className="text-sm text-primary hover:underline"
                >
                  {outstandingReportsCount} outstanding{" "}
                  {outstandingReportsCount === 1 ? "report" : "reports"} →
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session notes</CardTitle>
            </CardHeader>
            <CardContent>
              {missingNotesCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All completed appointments have a finalised session note.
                </p>
              ) : (
                <Link
                  href="/appointments?filter=past"
                  className="text-sm text-primary hover:underline"
                >
                  {missingNotesCount} completed{" "}
                  {missingNotesCount === 1 ? "appointment" : "appointments"}{" "}
                  without a finalised session note →
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clients without an appointment</CardTitle>
            </CardHeader>
            <CardContent>
              {clientsWithoutAppointmentCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every active client has an upcoming appointment.
                </p>
              ) : (
                <Link
                  href="/clients"
                  className="text-sm text-primary hover:underline"
                >
                  {clientsWithoutAppointmentCount} active{" "}
                  {clientsWithoutAppointmentCount === 1 ? "client" : "clients"}{" "}
                  with no upcoming appointment →
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
