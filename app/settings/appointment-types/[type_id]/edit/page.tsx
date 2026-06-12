import { notFound } from "next/navigation"

import { AppointmentTypeForm } from "@/components/appointment-types/appointment-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  getAppointmentTypeById,
  getClaimTypesForAppointmentTypes,
} from "@/lib/actions/appointment-types"
import { requirePractitionerContext } from "@/lib/auth"

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

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/settings/appointment-types/${typeId}`}
          label="← Back to appointment type"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit appointment type
        </h1>
      </div>

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
          fees: type.fees.map((fee) => ({
            fee: fee.fee,
            tax: fee.tax,
            startDate: fee.startDate,
            endDate: fee.endDate ?? "",
            status: fee.status as "active" | "inactive",
          })),
        }}
      />
    </AppShell>
  )
}
