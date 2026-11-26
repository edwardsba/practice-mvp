import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { AppShell } from "@/components/app-shell"
import { InterviewPage } from "@/components/client-background/interview-page"
import { clients, sessionNotes } from "@/db/schema"
import { getReferralFundingCardData } from "@/lib/actions/funding"
import { buildPractitionerStartHref } from "@/lib/assessments/practitioner-routes"
import {
  chooseTodaysSessionNote,
} from "@/lib/assessments/start-list"
import { requirePractitionerContext } from "@/lib/auth"
import { loadClientBackground, loadInProgressInterview, loadLatestBackgroundSelfReport, loadReasonSupport } from "@/lib/client-background/load"
import { ensureFamilyOfOrigin } from "@/lib/client-background/mutations"
import { loadEmergencyContacts } from "@/lib/crisis-plans/load"
import { todayDateString } from "@/lib/dates/practice-time"
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
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      phone: clients.phone,
      email: clients.email,
      address: clients.address,
      dateOfBirth: clients.dateOfBirth,
      commsOptOut: clients.commsOptOut,
      reminderOptOut: clients.reminderOptOut,
      preSessionOptOut: clients.preSessionOptOut,
      postSessionOptOut: clients.postSessionOptOut,
      adminCommsOptOut: clients.adminCommsOptOut,
      onlineBookingPermitted: clients.onlineBookingPermitted,
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

  const [selfReport, reasonSupport, claimsPage, referralFundingData, medicalContacts, emergencyContacts] =
    await Promise.all([
      loadLatestBackgroundSelfReport(clientId, context.practiceId),
      loadReasonSupport(clientId, context.practiceId, null),
      loadClaimsPageForClient(clientId),
      getReferralFundingCardData(clientId),
      loadMedicalContactsForClient(clientId, context.practiceId),
      loadEmergencyContacts(clientId, context.practiceId),
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

  const today = todayDateString()
  const notes = await db
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      sessionDate: sessionNotes.sessionDate,
    })
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.clientId, clientId),
        eq(sessionNotes.practiceId, context.practiceId),
        eq(sessionNotes.isActive, true)
      )
    )
  const todaysNote = chooseTodaysSessionNote(notes, today)
  const interviewReturnTo = `/clients/${clientId}/background/interview`
  const lrampStartHref = buildPractitionerStartHref({
    clientId,
    assessmentCode: "LRAMP",
    sessionNoteId: todaysNote?.sessionNoteId ?? null,
    returnTo: interviewReturnTo,
  })

  return (
    <AppShell>
      <InterviewPage
        clientId={clientId}
        practiceId={context.practiceId}
        clientName={`${client.firstName} ${client.lastName}`.trim()}
        data={data}
        screening={interview.screening}
        answers={interview.answers}
        selfReport={selfReport}
        reasonSupport={reasonSupport}
        medicalContacts={medicalContacts.map((row) => row.professional)}
        medicalContactLines={medicalContacts.map((row) => ({
          name: `${row.professional.firstName} ${row.professional.lastName}`.trim(),
          professionName: row.professional.professionName,
          isMain: row.isMain,
        }))}
        emergencyContacts={emergencyContacts.map((row) => ({
          name: row.name,
          role: row.role,
          phone: row.phone,
          email: row.email,
        }))}
        contactDetails={{
          phone: client.phone,
          email: client.email,
          address: client.address,
          comms: {
            commsOptOut: client.commsOptOut,
            reminderOptOut: client.reminderOptOut,
            preSessionOptOut: client.preSessionOptOut,
            postSessionOptOut: client.postSessionOptOut,
            adminCommsOptOut: client.adminCommsOptOut,
            onlineBookingPermitted: client.onlineBookingPermitted,
          },
        }}
        referralQuickViewLines={referralQuickViewLines}
        referralFormOptions={referralCard.formOptions}
        referralRecorded={anyReferralRecorded(referralFundingData.approvals)}
        lrampStartHref={lrampStartHref}
      />
    </AppShell>
  )
}
