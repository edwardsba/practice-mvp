import { getActiveClients } from "@/app/clients/actions"
import { FundingApprovalForm } from "@/components/funding/funding-approval-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  getClaimById,
  getClaims,
  getFundingApprovalTypesForForm,
  getReferrersForDropdown,
} from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewFundingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string
    client_id?: string
    clientId?: string
    claimId?: string
  }>
}) {
  const context = await requirePractitionerContext()
  const {
    returnTo,
    client_id: clientIdSnake,
    clientId: clientIdCamel,
    claimId: claimIdParam,
  } = await searchParams

  const claimFromParam = claimIdParam
    ? await getClaimById(claimIdParam)
    : null

  const [clients, approvalTypes, claims, referrers] = await Promise.all([
    getActiveClients(),
    getFundingApprovalTypesForForm(context.practiceId),
    getClaims(context.practiceId),
    getReferrersForDropdown(context.practiceId),
  ])

  const initialClientId =
    clientIdSnake ?? clientIdCamel ?? claimFromParam?.clientId ?? undefined
  const initialClaimId = claimFromParam?.claimId ?? undefined

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={returnTo ?? "/funding/approvals"}
          label="← Back"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add funding approval
        </h1>
      </div>

      <FundingApprovalForm
        clients={clients}
        approvalTypes={approvalTypes}
        claims={claims.map((claim) => ({
          claimId: claim.claimId,
          clientId: claim.clientId,
          claimTypeId: claim.claimTypeId,
          claimTypeName: claim.claimTypeName,
          startDate: claim.startDate,
        }))}
        referrers={referrers}
        initialValues={
          initialClientId || initialClaimId
            ? {
                clientId: initialClientId,
                claimId: initialClaimId,
              }
            : undefined
        }
        cancelHref={returnTo ?? "/funding/approvals"}
        returnTo={returnTo}
      />
    </AppShell>
  )
}
