import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  formatAppointmentDate,
  formatAppointmentDuration,
  formatAppointmentStatus,
  formatAppointmentTime,
  formatAutomationTimestamp,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import { loadSessionNoteForAppointment } from "@/lib/session-notes/load"

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointment_id: string }>
}) {
  const { appointment_id: appointmentId } = await params
  const context = await requirePractitionerContext()

  const [appointment, linkedSessionNote] = await Promise.all([
    loadAppointmentForPractice(appointmentId, context.practiceId),
    loadSessionNoteForAppointment(appointmentId, context.practiceId),
  ])

  if (!appointment) {
    notFound()
  }

  const clientName = formatClientNameLastFirst(
    appointment.clientFirstName,
    appointment.clientLastName
  )

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/appointments">← Back to appointments</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Appointment</h1>
          <div className="flex flex-wrap gap-2">
            {linkedSessionNote ? (
              <Button asChild variant="default">
                <Link href={`/session-notes/${linkedSessionNote.sessionNoteId}`}>
                  View Session Note
                </Link>
              </Button>
            ) : (
              <Button asChild variant="default">
                <Link
                  href={`/session-notes/new?appointment_id=${appointmentId}&client_id=${appointment.clientId}`}
                >
                  Create Session Note
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/appointments/${appointmentId}/edit`}>Edit</Link>
            </Button>
          </div>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Appointment details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Client</dt>
              <dd className="font-medium">
                <Link
                  href={`/clients/${appointment.clientId}`}
                  className="text-primary hover:underline"
                >
                  {clientName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium">
                {formatAppointmentStatus(appointment.status)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Date</dt>
              <dd className="font-medium">
                {formatAppointmentDate(appointment.appointmentDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Time</dt>
              <dd className="font-medium">
                {formatAppointmentTime(appointment.appointmentTime)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Duration</dt>
              <dd className="font-medium">
                {formatAppointmentDuration(appointment.durationMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Location</dt>
              <dd className="font-medium">
                {appointment.location?.trim() || "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Notes</dt>
              <dd className="font-medium whitespace-pre-wrap">
                {appointment.notes?.trim() || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Reminder</dt>
              <dd className="font-medium">
                {appointment.reminderSentAt
                  ? `Reminder sent: ${formatAutomationTimestamp(appointment.reminderSentAt)}`
                  : "Reminder not yet sent"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Pre-session battery</dt>
              <dd className="font-medium">
                {appointment.preSessionBatterySentAt
                  ? `Pre-session battery sent: ${formatAutomationTimestamp(appointment.preSessionBatterySentAt)}`
                  : "Pre-session battery not yet sent"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </AppShell>
  )
}
