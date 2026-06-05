import Link from "next/link"

import { AppointmentsFilter } from "@/app/appointments/appointments-filter"
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
import {
  APPOINTMENT_FILTER_VALUES,
  type AppointmentFilter,
} from "@/lib/appointments/constants"
import {
  formatAppointmentDate,
  formatAppointmentDuration,
  formatAppointmentStatus,
  formatAppointmentTime,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"
import { loadAppointmentsForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"

function parseFilter(value: string | undefined): AppointmentFilter {
  if (value && APPOINTMENT_FILTER_VALUES.includes(value as AppointmentFilter)) {
    return value as AppointmentFilter
  }
  return "upcoming"
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter: filterParam } = await searchParams
  const filter = parseFilter(filterParam)
  const context = await requirePractitionerContext()
  const appointments = await loadAppointmentsForPractice(
    context.practiceId,
    filter
  )

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
        <Button asChild>
          <Link href="/appointments/new">Add Appointment</Link>
        </Button>
      </div>

      <div className="mb-6">
        <AppointmentsFilter currentFilter={filter} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-20 text-center text-muted-foreground"
                >
                  No appointments scheduled.
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appointment) => {
                const clientName = formatClientNameLastFirst(
                  appointment.clientFirstName,
                  appointment.clientLastName
                )

                return (
                  <TableRow key={appointment.appointmentId}>
                    <TableCell>
                      {formatAppointmentDate(appointment.appointmentDate)}
                    </TableCell>
                    <TableCell>
                      {formatAppointmentTime(appointment.appointmentTime)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clients/${appointment.clientId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatAppointmentDuration(appointment.durationMinutes)}
                    </TableCell>
                    <TableCell>{appointment.location?.trim() || "—"}</TableCell>
                    <TableCell>
                      {formatAppointmentStatus(appointment.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-3 text-sm">
                        <Link
                          href={`/appointments/${appointment.appointmentId}`}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/appointments/${appointment.appointmentId}/edit`}
                          className="text-primary hover:underline"
                        >
                          Edit
                        </Link>
                      </div>
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
