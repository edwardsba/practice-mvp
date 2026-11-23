import { notFound } from "next/navigation"

import { ClaimsFundingPage } from "@/components/funding/claims-funding-page"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { getReferralFundingCardData } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"
import { buildReferralFundingCardProps } from "@/lib/funding/referral-funding-card-props"
import { loadClaimsPageForClient } from "@/lib/funding/load-claims-page"

export default async function ClientClaimsPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()

  const [loaded, referralFundingData] = await Promise.all([
    loadClaimsPageForClient(clientId),
    getReferralFundingCardData(clientId),
  ])

  if (!loaded) {
    notFound()
  }

  const referralFunding = buildReferralFundingCardProps(
    context.practiceId,
    referralFundingData
  )

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label={`← ${loaded.clientName}`}
        />
      </div>
      <EntityPageHeader
        kicker="Client"
        name="Claims, referrals and funding"
        subheading={loaded.clientName}
      />

      <ClaimsFundingPage
        clientId={clientId}
        model={loaded.model}
        referralFunding={referralFunding}
      />
    </AppShell>
  )
}
