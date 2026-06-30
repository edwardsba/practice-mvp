import Link from "next/link"
import { notFound } from "next/navigation"

import { createDraftSessionNote } from "@/app/session-notes/actions"
import { AppointmentStatusControl } from "@/components/appointments/appointment-status-control"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/appointment-types/format"
import {
  formatAppointmentTime,
  formatAutomationTimestamp,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"
import {
  APPOINTMENT_MODE_LABELS,
  type AppointmentMode,
} from "@/lib/appointments/constants"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { resolveAppointmentLocationText } from "@/lib/appointments/location"
import { requirePractitionerContext } from "@/lib/auth"
import {
  formatApprovalProgress,
  formatDisplayDate,
} from "@/lib/funding/format"
import { resolveBackNavigation } from "@/lib/navigation/back"
import { loadSessionNoteForAppointment } from "@/lib/session-notes/load"

function formatAppointmentDateTime(date: string, time: string): string {
  return `${formatDisplayDate(date)} at ${formatAppointmentTime(time)}`
}

export default async function AppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointment_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { appointment_id: appointmentId } = await params
  const { returnTo: returnToParam } = await searchParams
  const returnTo = returnToParam?.trim() || undefined
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
  const back = resolveBackNavigation(
    returnTo,
    "/appointments",
    "← Back to appointments"
  )
  const notes = appointment.notes?.trim() ?? ""

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={back.href}>{back.label}</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Appointment</h1>
          <div className="flex flex-wrap justify-end gap-2">
            {linkedSessionNote ? (
              <Button asChild variant="default">
                <Link href={`/session-notes/${linkedSessionNote.sessionNoteId}`}>
                  View Session Note
                </Link>
              </Button>
            ) : (
              <form
                action={createDraftSessionNote.bind(
                  null,
                  appointment.clientId,
                  appointmentId
                )}
              >
                <Button type="submit" variant="default">
                  Create Session Note
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Appointment</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/appointments/${appointmentId}/edit?returnTo=${encodeURIComponent(returnTo ?? "/appointments")}`}
            >
              Edit
            </Link>
          </Button>
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
              <dt className="text-sm text-muted-foreground">Date &amp; time</dt>
              <dd className="font-medium">
                {formatAppointmentDateTime(
                  appointment.appointmentDate,
                  appointment.appointmentTime
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Mode</dt>
              <dd className="font-medium">
                {APPOINTMENT_MODE_LABELS[
                  appointment.mode as AppointmentMode
                ] ?? appointment.mode}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Location</dt>
              <dd className="font-medium">
                {appointment.mode === "online"
                  ? "Online"
                  : resolveAppointmentLocationText(
                      appointment.location,
                      appointment.practiceLocationNickname ?? null,
                      appointment.practiceAddress ?? null,
                      appointment.practiceName ?? ""
                    )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fees</CardTitle>
        </CardHeader>
        <CardContent>
          {!appointment.appointmentTypeId ? (
            <p className="text-sm text-muted-foreground">
              No appointment type selected.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      {appointment.appointmentTypeNickname ?? "—"}
                    </TableCell>
                    <TableCell>
                      {appointment.appointmentTypeReferenceNumber?.trim() || "—"}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(appointment.appointmentTypeFee)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(appointment.appointmentTypeTax)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(appointment.appointmentTypeTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Claim</CardTitle>
        </CardHeader>
        <CardContent>
          {!appointment.fundingApprovalId ? (
            <p className="text-sm text-muted-foreground">
              No funding approval linked to this appointment.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Start</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{appointment.claimTypeName ?? "—"}</TableCell>
                    <TableCell>{appointment.approvalTypeName ?? "—"}</TableCell>
                    <TableCell>
                      {formatApprovalProgress(
                        appointment.appointmentsAttended ?? 0,
                        appointment.appointmentsApproved
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDisplayDate(appointment.fundingApprovalStartDate)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium">
                <AppointmentStatusControl
                  appointmentId={appointmentId}
                  currentStatus={appointment.status}
                />
              </dd>
            </div>
            {appointment.cancelledAt ? (
              <div>
                <dt className="text-sm text-muted-foreground">Cancelled</dt>
                <dd className="font-medium">
                  {formatAutomationTimestamp(appointment.cancelledAt)}
                  {appointment.cancellationSource
                    ? ` (${appointment.cancellationSource})`
                    : ""}
                </dd>
              </div>
            ) : null}
            <div className={notes.length > 80 ? "sm:col-span-2" : undefined}>
              <dt className="text-sm text-muted-foreground">Notes</dt>
              <dd className="font-medium whitespace-pre-wrap">
                {notes || "—"}
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
              <dt className="text-sm text-muted-foreground">
                Pre-session battery
              </dt>
              <dd className="font-medium">
                {appointment.preSessionBatterySentAt
                  ? `Pre-session battery sent: ${formatAutomationTimestamp(appointment.preSessionBatterySentAt)}`
                  : "Pre-session battery not yet sent"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Post-session feedback
              </dt>
              <dd className="font-medium">
                {appointment.postSessionSentAt
                  ? `Post-session feedback sent: ${formatAutomationTimestamp(appointment.postSessionSentAt)}`
                  : "Post-session feedback not yet sent"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </AppShell>
  )
}
