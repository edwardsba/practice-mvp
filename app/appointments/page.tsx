import Link from "next/link"

import { AppointmentsFilter } from "@/app/appointments/appointments-filter"
import { TestAutomationsButton } from "@/app/appointments/test-automations-button"
import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/ui/status-badge"
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
  formatAppointmentTime,
  formatClientNameLastFirst,
} from "@/lib/appointments/format"
import { resolveAppointmentLocationText } from "@/lib/appointments/location"
import { loadAppointmentsForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"
import { APPOINTMENT_STATUS_CONFIG } from "@/lib/status"

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
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
          {process.env.NODE_ENV === "development" ? (
            <TestAutomationsButton />
          ) : null}
          <Button asChild>
            <Link href="/appointments/new">Add Appointment</Link>
          </Button>
        </div>
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
                const clientName = formatClientNameLastFirst(
                  appointment.clientFirstName,
                  appointment.clientLastName
                )
                const appointmentHref = `/appointments/${appointment.appointmentId}`

                return (
                  <TableRow
                    key={appointment.appointmentId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={appointmentHref} className="block">
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
                        {clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block">
                        {formatAppointmentDuration(appointment.durationMinutes)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={appointmentHref} className="block">
                        {appointment.mode === "online"
                          ? "Online"
                          : resolveAppointmentLocationText(
                              appointment.location,
                              appointment.practiceLocationNickname ?? null,
                              appointment.practiceAddress ?? null,
                              appointment.practiceName ?? ""
                            )}
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
