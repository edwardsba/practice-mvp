import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { InterviewPage } from "@/components/client-background/interview-page"
import { clients } from "@/db/schema"
import { getReferralFundingCardData } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"
import { loadClientBackground, loadInProgressInterview, loadLatestBackgroundSelfReport, loadReasonSupport } from "@/lib/client-background/load"
import { ensureFamilyOfOrigin } from "@/lib/client-background/mutations"
import { db } from "@/lib/db"
import { buildReferralFundingQuickView } from "@/lib/funding/claims-page"
import { loadClaimsPageForClient } from "@/lib/funding/load-claims-page"
import {
  anyReferralRecorded,
  buildReferralFundingCardProps,
} from "@/lib/funding/referral-funding-card-props"
import { loadMedicalContactsForClient } from "@/lib/medical-contacts/load"

export default async function BackgroundInterviewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { client_id: clientId } = await params
  const query = await searchParams
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(
      and(eq(clients.clientId, clientId), eq(clients.practiceId, context.practiceId), eq(clients.isActive, true))
    )
    .limit(1)

  if (!client) notFound()

  const interview = await loadInProgressInterview(clientId, context.practiceId)
  if (!interview) redirect(`/clients/${clientId}/background`)

  await ensureFamilyOfOrigin({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
  })

  const data = await loadClientBackground(clientId, context.practiceId)
  if (!data) notFound()

  const [selfReport, reasonSupport, claimsPage, referralFundingData, medicalContacts] =
    await Promise.all([
      loadLatestBackgroundSelfReport(clientId, context.practiceId),
      loadReasonSupport(clientId, context.practiceId, null),
      loadClaimsPageForClient(clientId),
      getReferralFundingCardData(clientId),
      loadMedicalContactsForClient(clientId, context.practiceId),
    ])

  const referralCard = buildReferralFundingCardProps(
    context.practiceId,
    referralFundingData
  )
  const referralQuickViewLines = buildReferralFundingQuickView(
    claimsPage?.model ?? {
      referralsWithoutClaim: [],
      activeClaims: [],
      inactiveClaims: [],
      calendarYear: new Date().getFullYear(),
    }
  )

  return (
    <AppShell>
      <InterviewPage
        clientId={clientId}
        practiceId={context.practiceId}
        clientName={`${client.firstName} ${client.lastName}`.trim()}
        initialPage={query.page === "history" ? "history" : "background"}
        data={data}
        screening={interview.screening}
        selfReport={selfReport}
        reasonSupport={reasonSupport}
        medicalContacts={medicalContacts.map((row) => row.professional)}
        referralQuickViewLines={referralQuickViewLines}
        referralFormOptions={referralCard.formOptions}
        referralRecorded={anyReferralRecorded(referralFundingData.approvals)}
      />
    </AppShell>
  )
}
