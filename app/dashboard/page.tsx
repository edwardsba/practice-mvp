import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  formatAppointmentTime,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"
import {
  countAppointmentsMissingFinalisedNote,
  countOutstandingReports,
  loadTodaysAppointments,
} from "@/lib/dashboard/load"
import { APPOINTMENT_STATUS_CONFIG } from "@/lib/status"

export default async function DashboardPage() {
  const context = await requirePractitionerContext()

  const [todaysAppointments, outstandingReportsCount, missingNotesCount] =
    await Promise.all([
      loadTodaysAppointments(context.practiceId),
      countOutstandingReports(context.practiceId),
      countAppointmentsMissingFinalisedNote(context.practiceId),
    ])

  return (
    <AppShell title="Welcome">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {todaysAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No appointments scheduled today.
              </p>
            ) : (
              <ul className="divide-y">
                {todaysAppointments.map((appt) => (
                  <li key={appt.appointmentId} className="py-3">
                    <Link
                      href={`/appointments/${appt.appointmentId}`}
                      className="flex flex-wrap items-center justify-between gap-2 hover:underline"
                    >
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
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
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
        </div>
      </div>
    </AppShell>
  )
}
