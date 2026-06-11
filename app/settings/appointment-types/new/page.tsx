import { AppointmentTypeForm } from "@/components/appointment-types/appointment-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  getClaimTypesForAppointmentTypes,
  getPracticeMembershipsForForm,
} from "@/lib/actions/appointment-types"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewAppointmentTypePage() {
  const context = await requirePractitionerContext()
  const [claimTypes, memberships] = await Promise.all([
    getClaimTypesForAppointmentTypes(context.practiceId),
    getPracticeMembershipsForForm(context.practiceId),
  ])

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/settings/appointment-types"
          label="← Back to appointment types"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add appointment type
        </h1>
      </div>

      <AppointmentTypeForm
        practiceId={context.practiceId}
        claimTypes={claimTypes}
        memberships={memberships}
        cancelHref="/settings/appointment-types"
      />
    </AppShell>
  )
}
