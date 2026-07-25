import { ApprovalTypeForm } from "@/components/funding/approval-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { getClaimTypes } from "@/lib/actions/funding"
import { getReportTypes } from "@/lib/actions/report-types"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewFundingApprovalTypePage() {
  const context = await requirePractitionerContext()
  const [claimTypes, reportTypes] = await Promise.all([
    getClaimTypes(context.practiceId),
    getReportTypes(context.practiceId),
  ])

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/funding/approval-types"
          label="← Back to approval types"
        />
      </div>
      <ListPageHeader heading="Add funding approval type" />

      <ApprovalTypeForm
        practiceId={context.practiceId}
        claimTypes={claimTypes.map((type) => ({
          claimTypeId: type.claimTypeId,
          claimTypeName: type.claimTypeName,
        }))}
        reportTypes={reportTypes}
        cancelHref="/funding/approval-types"
      />
    </AppShell>
  )
}
