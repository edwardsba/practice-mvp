import { notFound } from "next/navigation"

import { getActiveClients } from "@/app/clients/actions"
import { ClaimForm } from "@/components/funding/claim-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { getClaimById, getClaimTypes, deleteClaim, getClaimDeleteStatus } from "@/lib/actions/funding"
import { getProfessionalOrganisations } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"
import { EntityDeleteSection } from "@/components/entity-delete-section"

export default async function EditClaimPage({
  params,
}: {
  params: Promise<{ claim_id: string }>
}) {
  const { claim_id: claimId } = await params
  const context = await requirePractitionerContext()
  const [claim, clients, claimTypes, organisations] = await Promise.all([
    getClaimById(claimId),
    getActiveClients(),
    getClaimTypes(context.practiceId),
    getProfessionalOrganisations(context.practiceId),
  ])

  if (!claim) {
    notFound()
  }

  const deleteStatus = await getClaimDeleteStatus(claimId, context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/funding/claims/${claimId}`}
          label="← Back to claim"
        />
      </div>
      <EntityPageHeader
        kicker="Claim edit"
        name={`${claim.clientFirstName} ${claim.clientLastName}`}
        subheading={claim.claimTypeName}
      />

      <ClaimForm
        clients={clients}
        claimTypes={claimTypes.map((type) => ({
          claimTypeId: type.claimTypeId,
          claimTypeName: type.claimTypeName,
        }))}
        organisations={organisations.map((org) => ({
          organisationId: org.organisationId,
          organisationName: org.organisationName,
        }))}
        initialValues={{
          claimId: claim.claimId,
          clientId: claim.clientId,
          claimTypeId: claim.claimTypeId,
          medicareCardNumber: claim.medicareCardNumber,
          medicareIrn: claim.medicareIrn,
          insuranceOrganisationId: claim.insuranceOrganisationId,
          insuranceReferenceNumber: claim.insuranceReferenceNumber,
          startDate: claim.startDate,
          endDate: claim.endDate,
        }}
        cancelHref={`/funding/claims/${claimId}`}
      />

      <EntityDeleteSection
        entityName="Claim"
        blockedReason={deleteStatus.blockedReason}
        deleteAction={deleteClaim.bind(null, claimId, context.practiceId)}
      />
    </AppShell>
  )
}
