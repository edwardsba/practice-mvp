import { ApprovalTypeForm } from "@/components/funding/approval-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { getClaimTypes } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewFundingApprovalTypePage() {
  const context = await requirePractitionerContext()
  const claimTypes = await getClaimTypes(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/funding/approval-types"
          label="← Back to approval types"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add funding approval type
        </h1>
      </div>

      <ApprovalTypeForm
        practiceId={context.practiceId}
        claimTypes={claimTypes.map((type) => ({
          claimTypeId: type.claimTypeId,
          claimTypeName: type.claimTypeName,
        }))}
        cancelHref="/funding/approval-types"
      />
    </AppShell>
  )
}
