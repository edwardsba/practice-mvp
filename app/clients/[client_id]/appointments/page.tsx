import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
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
  formatAppointmentStatus,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import { loadAppointmentsForClient } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import { appendReturnTo } from "@/lib/navigation/back"
import { db } from "@/lib/db"

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
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← {clientName}</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Appointments — {clientName}
          </h1>
          <Button asChild>
            <Link href={`/appointments/new?clientId=${clientId}`}>
              Add Appointment
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Funding Approval</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                      <Link href={appointmentHref} className="block hover:underline">
                        {formatAppointmentTime(appointment.appointmentTime)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block hover:underline">
                        {appointment.mode in APPOINTMENT_MODE_LABELS
                          ? APPOINTMENT_MODE_LABELS[
                              appointment.mode as AppointmentMode
                            ]
                          : appointment.mode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block hover:underline">
                        {formatAppointmentStatus(appointment.status)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block hover:underline">
                        {appointment.approvalTypeName ?? "—"}
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
