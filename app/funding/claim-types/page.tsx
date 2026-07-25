import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { ClaimTypesManager } from "@/components/funding/claim-types-manager"
import { getClaimTypes } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"

export default async function ClaimTypesPage() {
  const context = await requirePractitionerContext()
  const claimTypes = await getClaimTypes(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practice" label="← Back to practice" />
      </div>
      <ListPageHeader heading="Claim types" />

      <ClaimTypesManager
        practiceId={context.practiceId}
        claimTypes={claimTypes.map((type) => ({
          claimTypeId: type.claimTypeId,
          claimTypeName: type.claimTypeName,
        }))}
      />
    </AppShell>
  )
}
