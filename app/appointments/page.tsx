import Link from "next/link"

import { AppointmentsFilter } from "@/app/appointments/appointments-filter"
import { TestAutomationsButton } from "@/app/appointments/test-automations-button"
import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { ListPageHeader } from "@/components/ui/list-page-header"
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
import { APPOINTMENT_STATUS_CONFIG, SESSION_NOTE_STATUS_CONFIG } from "@/lib/status"

function parseFilter(value: string | undefined): AppointmentFilter {
  if (value && APPOINTMENT_FILTER_VALUES.includes(value as AppointmentFilter)) {
    return value as AppointmentFilter
  }
  return "all"
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
      <ListPageHeader
        heading="Appointments"
        action={
          <Button asChild>
            <Link href="/appointments/new">Add Appointment</Link>
          </Button>
        }
      />

      <div className="mb-6 flex items-center justify-between gap-4">
        <AppointmentsFilter currentFilter={filter} />
        <div className="flex items-center gap-3">
          {process.env.NODE_ENV === "development" ? (
            <TestAutomationsButton />
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Session note</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Location</TableHead>
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
