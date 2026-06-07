import { notFound } from "next/navigation"

import { getActiveClients } from "@/app/clients/actions"
import { FundingApprovalForm } from "@/components/funding/funding-approval-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  getClaimsForClientDropdown,
  getFundingApprovalById,
  getFundingApprovalTypesForForm,
  getReferrersForDropdown,
} from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditFundingApprovalPage({
  params,
}: {
  params: Promise<{ approval_id: string }>
}) {
  const { approval_id: approvalId } = await params
  const context = await requirePractitionerContext()
  const approval = await getFundingApprovalById(approvalId)

  if (!approval) {
    notFound()
  }

  const [clients, approvalTypes, claims, referrers] = await Promise.all([
    getActiveClients(),
    getFundingApprovalTypesForForm(context.practiceId),
    getClaimsForClientDropdown(approval.clientId),
    getReferrersForDropdown(context.practiceId),
  ])

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/funding/approvals/${approvalId}`}
          label="← Back to funding approval"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit funding approval
        </h1>
      </div>

      <FundingApprovalForm
        clients={clients}
        approvalTypes={approvalTypes}
        claims={claims.map((claim) => ({
          claimId: claim.claimId,
          clientId: approval.clientId,
          claimTypeName: claim.claimTypeName,
          startDate: claim.startDate,
        }))}
        referrers={referrers}
        clientReports={approval.clientReports}
        initialValues={{
          fundingApprovalId: approval.fundingApprovalId,
          clientId: approval.clientId,
          fundingApprovalTypeId: approval.fundingApprovalTypeId,
          claimId: approval.claimId,
          referrerId: approval.referrerId,
          startDate: approval.startDate,
          endDate: approval.endDate,
          appointmentsApproved: approval.appointmentsApproved,
          appointmentsAttended: approval.appointmentsAttended,
          approvalStatus: approval.approvalStatus,
          linkedAppointments: approval.linkedAppointments,
          reportLinks: approval.reportLinks.map((link) => ({
            appointmentNumber: link.appointmentNumber,
            reportType: link.reportType,
            simpleReportId: link.simpleReportId,
          })),
        }}
        cancelHref={`/funding/approvals/${approvalId}`}
      />
    </AppShell>
  )
}
