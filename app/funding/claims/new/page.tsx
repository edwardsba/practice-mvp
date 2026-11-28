import { getActiveClients } from "@/app/clients/actions"
import { ClaimForm } from "@/components/funding/claim-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { getClaimTypes } from "@/lib/actions/funding"
import { getProfessionalOrganisations } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>
}) {
  const context = await requirePractitionerContext()
  const { client_id: searchParamsClientId } = await searchParams
  const clientId = searchParamsClientId?.trim() || undefined
  const cancelHref = clientId
    ? `/clients/${clientId}/claims`
    : "/funding/claims"
  const [clients, claimTypes, organisations] = await Promise.all([
    getActiveClients(),
    getClaimTypes(context.practiceId),
    getProfessionalOrganisations(context.practiceId),
  ])

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          page="/funding/claims/new"
          data={{ clientId, queryClientId: clientId }}
          identifyingSearchKeys={["client_id"]}
        />
      </div>
      <ListPageHeader heading="Add claim" />

      <ClaimForm
        clients={clients}
        claimTypes={claimTypes.map((type) => ({
          claimTypeId: type.claimTypeId,
          claimTypeName: type.claimTypeName,
          code: type.code,
        }))}
        organisations={organisations.map((org) => ({
          organisationId: org.organisationId,
          organisationName: org.organisationName,
        }))}
        initialValues={
          clientId ? { clientId } : undefined
        }
        lockClient={Boolean(clientId)}
        cancelHref={cancelHref}
      />
    </AppShell>
  )
}
