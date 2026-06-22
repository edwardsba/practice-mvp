import { notFound } from "next/navigation"

import { ApprovalTypeForm } from "@/components/funding/approval-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { getClaimTypes, getFundingApprovalTypeById, deleteFundingApprovalType, getFundingApprovalTypeDeleteStatus } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"
import { EntityDeleteSection } from "@/components/entity-delete-section"

export default async function EditFundingApprovalTypePage({
  params,
}: {
  params: Promise<{ type_id: string }>
}) {
  const { type_id: typeId } = await params
  const context = await requirePractitionerContext()
  const [type, claimTypes] = await Promise.all([
    getFundingApprovalTypeById(context.practiceId, typeId),
    getClaimTypes(context.practiceId),
  ])

  if (!type) {
    notFound()
  }

  const deleteStatus = await getFundingApprovalTypeDeleteStatus(
    context.practiceId,
    typeId
  )

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/funding/approval-types/${typeId}`}
          label="← Back to approval type"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit funding approval type
        </h1>
      </div>

      <ApprovalTypeForm
        practiceId={context.practiceId}
        claimTypes={claimTypes.map((claimType) => ({
          claimTypeId: claimType.claimTypeId,
          claimTypeName: claimType.claimTypeName,
        }))}
        initialValues={{
          fundingApprovalTypeId: type.fundingApprovalTypeId,
          name: type.name,
          claimTypeId: type.claimTypeId,
          durationMonths: type.durationMonths,
          appointmentsApproved: type.appointmentsApproved,
          reports: type.reports.map((report) => ({
            appointmentNumber: report.appointmentNumber,
            reportType: report.reportType,
          })),
        }}
        cancelHref={`/funding/approval-types/${typeId}`}
      />

      <EntityDeleteSection
        entityName="Funding Approval Type"
        blockedReason={deleteStatus.blockedReason}
        deleteAction={deleteFundingApprovalType.bind(
          null,
          typeId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
