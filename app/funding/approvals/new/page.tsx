import { getActiveClients } from "@/app/clients/actions"
import { FundingApprovalForm } from "@/components/funding/funding-approval-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import {
  getClaimById,
  getClaims,
  getClaimsForClientDropdown,
  getFundingApprovalTypesForForm,
  getReferrersForDropdown,
  getReferralFundingCardData,
} from "@/lib/actions/funding"
import { getProfessions, getProfessionalOrganisations } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"
import { PRIVATE_CLAIM_TYPE_NAME } from "@/lib/funding/referral"
import { safeReturnTo } from "@/lib/navigation/safe-return-to"
import { and, eq } from "drizzle-orm"
import { claimTypes } from "@/db/schema"
import { db } from "@/lib/db"

export default async function NewFundingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string
    client_id?: string
    clientId?: string
    claim_id?: string
    claimId?: string
    kind?: string
  }>
}) {
  const context = await requirePractitionerContext()
  const {
    returnTo: returnToRaw,
    client_id: clientIdSnake,
    clientId: clientIdCamel,
    claim_id: claimIdSnake,
    claimId: claimIdCamel,
    kind,
  } = await searchParams

  const returnTo = safeReturnTo(returnToRaw) ?? undefined
  const claimIdParam = claimIdSnake ?? claimIdCamel

  const claimFromParam = claimIdParam
    ? await getClaimById(claimIdParam)
    : null

  const initialClientId =
    clientIdSnake ?? clientIdCamel ?? claimFromParam?.clientId ?? undefined
  const initialClaimId = claimFromParam?.claimId ?? undefined

  const [
    clients,
    approvalTypes,
    allClaims,
    clientClaims,
    referrers,
    professions,
    organisations,
    privateClaimType,
    clientCardData,
  ] = await Promise.all([
    getActiveClients(),
    getFundingApprovalTypesForForm(context.practiceId),
    initialClientId ? Promise.resolve([]) : getClaims(context.practiceId),
    initialClientId
      ? getClaimsForClientDropdown(initialClientId)
      : Promise.resolve([]),
    getReferrersForDropdown(context.practiceId),
    getProfessions(context.practiceId),
    getProfessionalOrganisations(context.practiceId),
    db
      .select({ claimTypeId: claimTypes.claimTypeId })
      .from(claimTypes)
      .where(
        and(
          eq(claimTypes.practiceId, context.practiceId),
          eq(claimTypes.isActive, true),
          eq(claimTypes.claimTypeName, PRIVATE_CLAIM_TYPE_NAME)
        )
      )
      .limit(1),
    initialClientId
      ? getReferralFundingCardData(initialClientId)
      : Promise.resolve(null),
  ])

  const claims = initialClientId
    ? clientClaims.map((claim) => ({
        claimId: claim.claimId,
        clientId: initialClientId,
        claimTypeId: claim.claimTypeId,
        claimTypeName: claim.claimTypeName,
        startDate: claim.startDate,
      }))
    : allClaims.map((claim) => ({
        claimId: claim.claimId,
        clientId: claim.clientId,
        claimTypeId: claim.claimTypeId,
        claimTypeName: claim.claimTypeName,
        startDate: claim.startDate,
      }))

  const heading =
    kind?.trim().toLowerCase() === "referral"
      ? "Add referral"
      : "Add funding approval"

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/funding/approvals"
          label="← Back"
        />
      </div>
      <ListPageHeader heading={heading} />

      <FundingApprovalForm
        practiceId={context.practiceId}
        clients={clients}
        approvalTypes={approvalTypes}
        claims={claims}
        referrers={referrers}
        relationships={clientCardData?.relationships ?? []}
        professions={professions}
        organisations={organisations.map((org) => ({
          organisationId: org.organisationId,
          organisationName: org.organisationName,
        }))}
        privateClaimTypeId={privateClaimType[0]?.claimTypeId ?? null}
        lockClient={Boolean(initialClientId)}
        initialKind={kind}
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
