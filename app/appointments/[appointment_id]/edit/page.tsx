import Link from "next/link"
import { notFound } from "next/navigation"

import { updateAppointment, deleteAppointment, getAppointmentDeleteStatus } from "@/app/appointments/actions"
import { getPractitionerProfile } from "@/app/practitioner/actions"
import { getActiveClients } from "@/app/clients/actions"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { AppShell } from "@/components/app-shell"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { Button } from "@/components/ui/button"
import { getMemberships } from "@/lib/actions/practitioner-practice"
import { loadAppointmentForPractice } from "@/lib/appointments/load"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointment_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { appointment_id: appointmentId } = await params
  const { returnTo } = await searchParams
  const context = await requirePractitionerContext()

  const [appointment, clients, memberships, profile] = await Promise.all([
    loadAppointmentForPractice(appointmentId, context.practiceId),
    getActiveClients(),
    getMemberships(context.practitionerProfileId),
    getPractitionerProfile(),
  ])
  const timeIntervalMinutes = profile?.calendarIntervalMinutes ?? 30

  if (!appointment) {
    notFound()
  }

  const deleteStatus = await getAppointmentDeleteStatus(appointmentId)

  const clientName = `${appointment.clientFirstName} ${appointment.clientLastName}`

  const availabilityBlocks = memberships.flatMap((membership) =>
    membership.availabilityBlocks.map((block) => ({
      dayOfWeek: block.dayOfWeek,
      startTime: block.startTime,
      endTime: block.endTime,
      mode: block.mode,
    }))
  )

  const practiceMemberships = memberships.map((membership) => ({
    membershipId: membership.membershipId,
    practiceName: membership.practiceName,
  }))

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/appointments/${appointmentId}`}>← Back</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit appointment
        </h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <AppointmentForm
        action={updateAppointment.bind(null, appointmentId, returnTo)}
        clients={clients}
        practiceId={context.practiceId}
        availabilityBlocks={availabilityBlocks}
        practiceMemberships={practiceMemberships}
        timeIntervalMinutes={timeIntervalMinutes}
        initialValues={{
          clientId: appointment.clientId,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          durationMinutes: appointment.durationMinutes,
          mode: appointment.mode,
          fundingApprovalId: appointment.fundingApprovalId,
          appointmentTypeId: appointment.appointmentTypeId,
          membershipId: appointment.membershipId ?? "",
          notes: appointment.notes,
        }}
        submitLabel="Save appointment"
        cancelHref="/appointments"
      />

      <EntityDeleteSection
        entityName="Appointment"
        blockedReason={deleteStatus.blockedReason}
        deleteAction={deleteAppointment.bind(
          null,
          appointmentId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
