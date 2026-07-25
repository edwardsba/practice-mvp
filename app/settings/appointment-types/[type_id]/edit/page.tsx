import { notFound } from "next/navigation"

import { AppointmentTypeForm } from "@/components/appointment-types/appointment-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  getAppointmentTypeById,
  getClaimTypesForAppointmentTypes,
  deleteAppointmentType,
  getAppointmentTypeDeleteStatus,
} from "@/lib/actions/appointment-types"
import { requirePractitionerContext } from "@/lib/auth"
import { EntityDeleteSection } from "@/components/entity-delete-section"

export default async function EditAppointmentTypePage({
  params,
}: {
  params: Promise<{ type_id: string }>
}) {
  const { type_id: typeId } = await params
  const context = await requirePractitionerContext()

  const [type, claimTypes] = await Promise.all([
    getAppointmentTypeById(context.practiceId, typeId),
    getClaimTypesForAppointmentTypes(context.practiceId),
  ])

  if (!type) {
    notFound()
  }

  const deleteStatus = await getAppointmentTypeDeleteStatus(
    context.practiceId,
    typeId
  )

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/settings/appointment-types/${typeId}`}
          label="← Back to appointment type"
        />
      </div>
      <EntityPageHeader kicker="Appointment type edit" name={type.nickname} />

      <AppointmentTypeForm
        practiceId={context.practiceId}
        claimTypes={claimTypes}
        cancelHref={`/settings/appointment-types/${typeId}`}
        initialValues={{
          appointmentTypeId: type.appointmentTypeId,
          nickname: type.nickname,
          name: type.name,
          referenceNumber: type.referenceNumber,
          claimTypeId: type.claimTypeId,
          mode: type.mode,
          durationMinutes: type.durationMinutes,
          status: type.status,
          isNoShowType: type.isNoShowType,
          fees: type.fees.map((fee) => ({
            fee: fee.fee,
            tax: fee.tax,
            startDate: fee.startDate,
            endDate: fee.endDate ?? "",
            status: fee.status as "active" | "inactive",
          })),
        }}
      />

      <EntityDeleteSection
        entityName="Appointment Type"
        blockedReason={deleteStatus.blockedReason}
        deleteAction={deleteAppointmentType.bind(
          null,
          typeId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
