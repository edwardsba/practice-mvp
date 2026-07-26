import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { clients } from "@/db/schema"
import {
  APPOINTMENT_MODE_LABELS,
  type AppointmentMode,
} from "@/lib/appointments/constants"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import { loadAppointmentsForClient } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import { appendReturnTo } from "@/lib/navigation/back"
import { db } from "@/lib/db"
import { APPOINTMENT_STATUS_CONFIG, SESSION_NOTE_STATUS_CONFIG } from "@/lib/status"

export default async function ClientAppointmentsPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    notFound()
  }

  const appointments = await loadAppointmentsForClient(
    clientId,
    context.practiceId
  )
  const clientName = `${client.firstName} ${client.lastName}`
  const returnTo = `/clients/${clientId}/appointments`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label={`← ${clientName}`}
        />
      </div>
      <EntityPageHeader
        kicker="Appointments"
        name={clientName}
        subheading={`${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`}
        action={
          <Button asChild>
            <Link href={appendReturnTo(`/appointments/new?clientId=${clientId}`, returnTo)}>
              Add Appointment
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Session note</TableHead>
              <TableHead>Funding approval</TableHead>
              <TableHead>Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-20 text-center text-muted-foreground"
                >
                  No appointments scheduled.
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appointment) => {
                const appointmentHref = appendReturnTo(
                  `/appointments/${appointment.appointmentId}`,
                  returnTo
                )
                return (
                  <TableRow
                    key={appointment.appointmentId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={appointmentHref}
                        className="block font-medium text-primary hover:underline"
                      >
                        {formatAppointmentDate(appointment.appointmentDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block">
                        {formatAppointmentTime(appointment.appointmentTime)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block">
                        <StatusBadge
                          status={appointment.status}
                          statusMap={APPOINTMENT_STATUS_CONFIG}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block">
                        {appointment.sessionNoteStatus ? (
                          <StatusBadge
                            status={appointment.sessionNoteStatus}
                            statusMap={SESSION_NOTE_STATUS_CONFIG}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block">
                        {appointment.approvalTypeName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block">
                        {appointment.mode in APPOINTMENT_MODE_LABELS
                          ? APPOINTMENT_MODE_LABELS[appointment.mode as AppointmentMode]
                          : appointment.mode}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
