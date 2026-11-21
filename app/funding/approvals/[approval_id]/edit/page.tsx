import { notFound } from "next/navigation"

import { getActiveClients } from "@/app/clients/actions"
import { FundingApprovalForm } from "@/components/funding/funding-approval-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  getClaimsForClientDropdown,
  getFundingApprovalById,
  getFundingApprovalTypesForForm,
  getReferrersForDropdown,
  getReferralFundingCardData,
  deleteFundingApproval,
} from "@/lib/actions/funding"
import { getProfessions, getProfessionalOrganisations } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { PRIVATE_CLAIM_TYPE_NAME } from "@/lib/funding/referral"
import { and, eq } from "drizzle-orm"
import { claimTypes } from "@/db/schema"
import { db } from "@/lib/db"

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

  const [
    clients,
    approvalTypes,
    claims,
    referrers,
    professions,
    organisations,
    privateClaimType,
    cardData,
  ] = await Promise.all([
    getActiveClients(),
    getFundingApprovalTypesForForm(context.practiceId),
    getClaimsForClientDropdown(approval.clientId),
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
    getReferralFundingCardData(approval.clientId),
  ])

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/funding/approvals/${approvalId}`}
          label="← Back to funding approval"
        />
      </div>
      <EntityPageHeader
        kicker="Funding approval edit"
        name={`${approval.clientFirstName} ${approval.clientLastName}`}
        subheading={approval.approvalTypeName ?? undefined}
      />

      <FundingApprovalForm
        practiceId={context.practiceId}
        clients={clients}
        approvalTypes={approvalTypes}
        claims={claims.map((claim) => ({
          claimId: claim.claimId,
          clientId: approval.clientId,
          claimTypeId: claim.claimTypeId,
          claimTypeName: claim.claimTypeName,
          startDate: claim.startDate,
        }))}
        referrers={referrers}
        relationships={cardData.relationships}
        professions={professions}
        organisations={organisations.map((org) => ({
          organisationId: org.organisationId,
          organisationName: org.organisationName,
        }))}
        privateClaimTypeId={privateClaimType[0]?.claimTypeId ?? null}
        lockClient
        initialValues={{
          fundingApprovalId: approval.fundingApprovalId,
          clientId: approval.clientId,
          fundingApprovalTypeId: approval.fundingApprovalTypeId,
          claimId: approval.claimId,
          referrerId: approval.referrerId,
          referralDate: approval.referralDate,
          referrerComments: approval.referrerComments,
          referralSource: approval.referralSource,
          referrerRelationshipId: approval.referrerRelationshipId,
          referrerOther: approval.referrerOther,
          startDate: approval.startDate,
          endDate: approval.endDate,
          appointmentsApproved: approval.appointmentsApproved,
          appointmentsAttended: approval.appointmentsAttended,
          approvalStatus: approval.approvalStatus,
          linkedAppointments: approval.linkedAppointments,
        }}
        cancelHref={`/funding/approvals/${approvalId}`}
      />

      <EntityDeleteSection
        entityName="Funding Approval"
        deleteAction={deleteFundingApproval.bind(
          null,
          approvalId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
