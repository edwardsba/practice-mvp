import { getActiveClients } from "@/app/clients/actions"
import { ClaimForm } from "@/components/funding/claim-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { getClaimTypes } from "@/lib/actions/funding"
import { getProfessionalOrganisations } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"
import { safeReturnTo } from "@/lib/navigation/safe-return-to"

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; client_id?: string }>
}) {
  const context = await requirePractitionerContext()
  const { returnTo: returnToRaw, client_id: searchParamsClientId } =
    await searchParams
  const returnTo = safeReturnTo(returnToRaw) ?? undefined
  const [clients, claimTypes, organisations] = await Promise.all([
    getActiveClients(),
    getClaimTypes(context.practiceId),
    getProfessionalOrganisations(context.practiceId),
  ])

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/funding/claims" label="← Back" />
      </div>
      <ListPageHeader heading="Add claim" />

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
        initialValues={
          searchParamsClientId
            ? { clientId: searchParamsClientId }
            : undefined
        }
        lockClient={Boolean(searchParamsClientId)}
        cancelHref={returnTo ?? "/funding/claims"}
        returnTo={returnTo}
      />
    </AppShell>
  )
}
