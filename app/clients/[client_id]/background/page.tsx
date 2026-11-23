import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { ClientBackgroundPage } from "@/components/client-background/client-background-page"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { clients } from "@/db/schema"
import { getReferralFundingCardData } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"
import { loadBackgroundInterviewCard, loadClientBackground, loadLatestBackgroundSelfReport, loadReasonSupport } from "@/lib/client-background/load"
import { ensureFamilyOfOrigin } from "@/lib/client-background/mutations"
import { db } from "@/lib/db"
import { buildReferralFundingQuickView } from "@/lib/funding/claims-page"
import { loadClaimsPageForClient } from "@/lib/funding/load-claims-page"
import { anyReferralRecorded } from "@/lib/funding/referral-funding-card-props"
import { loadMedicalContactsForClient } from "@/lib/medical-contacts/load"

export default async function ClientBackgroundRoute({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) notFound()

  await ensureFamilyOfOrigin({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
  })

  const data = await loadClientBackground(clientId, context.practiceId)
  if (!data) notFound()
  const [interview, selfReport, reasonSupport, claimsPage, referralFundingData, medicalContacts] =
    await Promise.all([
      loadBackgroundInterviewCard(clientId, context.practiceId),
      loadLatestBackgroundSelfReport(clientId, context.practiceId),
      loadReasonSupport(clientId, context.practiceId, null),
      loadClaimsPageForClient(clientId),
      getReferralFundingCardData(clientId),
      loadMedicalContactsForClient(clientId, context.practiceId),
    ])
  if (!interview) notFound()

  const referralQuickViewLines = buildReferralFundingQuickView(
    claimsPage?.model ?? {
      referralsWithoutClaim: [],
      activeClaims: [],
      inactiveClaims: [],
      calendarYear: new Date().getFullYear(),
    }
  )
  const referralRecorded = anyReferralRecorded(referralFundingData.approvals)
  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref={`/clients/${clientId}`} label={`← ${clientName}`} />
      </div>
      <EntityPageHeader
        kicker="Client Background"
        name={clientName}
        subheading="Referral, demographics, relationships, history, and risk"
      />
      <ClientBackgroundPage
        clientId={clientId}
        clientName={client.firstName || clientName}
        practiceId={context.practiceId}
        data={data}
        interview={interview}
        numberOfChildren={selfReport?.answers.familyHome.numberOfChildren ?? null}
        reasonSupport={reasonSupport}
        medicalContacts={medicalContacts.map((row) => row.professional)}
        referralQuickViewLines={referralQuickViewLines}
        referralRecorded={referralRecorded}
      />
    </AppShell>
  )
}
