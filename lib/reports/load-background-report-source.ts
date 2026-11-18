import "server-only"

import { and, asc, eq } from "drizzle-orm"

import {
  clientBackgroundInterviews,
  clients,
  fundingApprovals,
  practitionerPracticeMemberships,
  practitionerProfiles,
  professionals,
  professions,
} from "@/db/schema"
import { sanitizeScreening } from "@/lib/client-background/interview-history"
import { loadClientBackground, loadLatestBackgroundSelfReport, loadReasonSupport } from "@/lib/client-background/load"
import { db } from "@/lib/db"
import { pickApprovalForReportDate } from "@/lib/funding/referral"
import {
  chooseReportInterviews,
  type BackgroundReportReferralInfo,
  type BackgroundReportSource,
} from "@/lib/reports/generate-background-report"

function isoDate(value: Date): string {
  return value.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" })
}

function referralSourceValue(
  value: string | null | undefined
): BackgroundReportReferralInfo["referralSource"] {
  if (value === "self" || value === "family_or_friend" || value === "other") return value
  return ""
}

export async function loadBackgroundReportSource({
  clientId,
  practiceId,
  practitionerProfileId,
  reportDate,
}: {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  reportDate: string
}): Promise<BackgroundReportSource | null> {
  const data = await loadClientBackground(clientId, practiceId)
  if (!data) return null

  const [client] = await db
    .select({ firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(and(eq(clients.clientId, clientId), eq(clients.practiceId, practiceId)))
    .limit(1)
  if (!client) return null

  const [practitioner] = await db
    .select({
      firstName: practitionerProfiles.firstName,
      lastName: practitionerProfiles.lastName,
      reportIntroduction: practitionerProfiles.reportIntroduction,
    })
    .from(practitionerProfiles)
    .innerJoin(
      practitionerPracticeMemberships,
      and(
        eq(practitionerPracticeMemberships.practitionerProfileId, practitionerProfiles.practitionerProfileId),
        eq(practitionerPracticeMemberships.practiceId, practiceId)
      )
    )
    .where(eq(practitionerProfiles.practitionerProfileId, practitionerProfileId))
    .limit(1)

  const interviewRows = await db
    .select({
      status: clientBackgroundInterviews.status,
      startedAt: clientBackgroundInterviews.startedAt,
      completedAt: clientBackgroundInterviews.completedAt,
      screeningJson: clientBackgroundInterviews.screeningJson,
    })
    .from(clientBackgroundInterviews)
    .where(
      and(
        eq(clientBackgroundInterviews.clientId, clientId),
        eq(clientBackgroundInterviews.practiceId, practiceId)
      )
    )
    .orderBy(asc(clientBackgroundInterviews.startedAt))

  const candidates = interviewRows.flatMap((row) => {
    if (row.status !== "completed" && row.status !== "in_progress") return []
    const at = row.status === "completed" && row.completedAt ? row.completedAt : row.startedAt
    if (!at) return []
    return [
      {
        status: row.status,
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        date: isoDate(at),
        screeningJson: row.screeningJson,
      },
    ]
  })
  const chosen = chooseReportInterviews(candidates)
  const chosenRow = chosen.answerIndex == null ? null : candidates[chosen.answerIndex]
  const screening = chosenRow ? sanitizeScreening(chosenRow.screeningJson) : null
  const interviews = chosen.dates.map((date) => ({ date }))
  const interviewDate = interviews[0]?.date ?? null

  const selfReport = await loadLatestBackgroundSelfReport(clientId, practiceId)

  const approvalRows = await db
    .select({
      fundingApprovalId: fundingApprovals.fundingApprovalId,
      startDate: fundingApprovals.startDate,
      endDate: fundingApprovals.endDate,
      createdAt: fundingApprovals.createdAt,
      referrerId: fundingApprovals.referrerId,
      referralDate: fundingApprovals.referralDate,
      referrerComments: fundingApprovals.referrerComments,
      referralSource: fundingApprovals.referralSource,
      referrerRelationshipId: fundingApprovals.referrerRelationshipId,
      referrerOther: fundingApprovals.referrerOther,
    })
    .from(fundingApprovals)
    .where(
      and(
        eq(fundingApprovals.clientId, clientId),
        eq(fundingApprovals.practiceId, practiceId),
        eq(fundingApprovals.isActive, true)
      )
    )

  const picked = pickApprovalForReportDate(approvalRows, interviewDate)
  let referral: BackgroundReportReferralInfo | null = null
  if (picked) {
    let referrer: BackgroundReportReferralInfo["referrer"] = null
    if (picked.referrerId) {
      const [professional] = await db
        .select({
          title: professionals.title,
          firstName: professionals.firstName,
          lastName: professionals.lastName,
          professionName: professions.professionName,
        })
        .from(professionals)
        .leftJoin(
          professions,
          and(eq(professions.professionId, professionals.professionId), eq(professions.practiceId, practiceId))
        )
        .where(and(eq(professionals.professionalId, picked.referrerId), eq(professionals.practiceId, practiceId)))
        .limit(1)
      if (professional) {
        referrer = {
          title: professional.title,
          firstName: professional.firstName,
          lastName: professional.lastName,
          profession: professional.professionName,
        }
      }
    }
    referral = {
      referrer,
      referralDate: picked.referralDate?.trim() || null,
      referrerComments: picked.referrerComments?.trim() || "",
      referralSource: referralSourceValue(picked.referralSource),
      referrerRelationshipId: picked.referrerRelationshipId,
      referrerOther: picked.referrerOther?.trim() || "",
    }
  }

  const practitionerName = practitioner
    ? [practitioner.firstName.trim(), practitioner.lastName.trim()].filter(Boolean).join(" ")
    : ""

  const selectedProfessionalIds = data.events
    .map((event) => event.prescriberProfessionalId)
    .filter((id): id is string => Boolean(id))
  const selectedProfessionalId = selectedProfessionalIds[0] ?? null

  return {
    reportDate,
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    dateOfBirth: data.dateOfBirth,
    practitionerName,
    practitionerReportIntroduction: practitioner?.reportIntroduction ?? null,
    data,
    screening,
    screeningFromIncomplete: chosen.writtenFromIncomplete,
    interviews,
    selfReportDate: selfReport ? isoDate(new Date(selfReport.assessmentDate)) : null,
    numberOfChildren: selfReport?.answers.familyHome.numberOfChildren ?? null,
    referral,
    professionals: (await loadReasonSupport(clientId, practiceId, selectedProfessionalId)).professionals,
  }
}
