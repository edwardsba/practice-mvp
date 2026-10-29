import "server-only"

import { and, asc, eq } from "drizzle-orm"

import {
  clientBackgroundInterviews,
  clients,
  practitionerPracticeMemberships,
  practitionerProfiles,
  professionals,
  professions,
} from "@/db/schema"
import { sanitizeScreening } from "@/lib/client-background/interview-history"
import { loadClientBackground, loadLatestBackgroundSelfReport } from "@/lib/client-background/load"
import { db } from "@/lib/db"
import type { BackgroundReportSource } from "@/lib/reports/generate-background-report"

function isoDate(value: Date): string {
  return value.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" })
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

  const usable = interviewRows.filter((row) => row.status === "completed" || row.status === "in_progress")
  const latestInterview = usable[usable.length - 1] ?? null
  const screening = latestInterview ? sanitizeScreening(latestInterview.screeningJson) : null
  const interviews = usable.flatMap((row) => {
    const at = row.status === "completed" && row.completedAt ? row.completedAt : row.startedAt
    return at ? [{ date: isoDate(at) }] : []
  })

  const selfReport = await loadLatestBackgroundSelfReport(clientId, practiceId)

  let referral: BackgroundReportSource["referral"] = null
  const referrerId = data.reason.referrerProfessionalId
  if (referrerId) {
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
      .where(and(eq(professionals.professionalId, referrerId), eq(professionals.practiceId, practiceId)))
      .limit(1)
    if (professional) {
      referral = {
        title: professional.title,
        firstName: professional.firstName,
        lastName: professional.lastName,
        profession: professional.professionName,
        date: data.reason.referralDate.trim() || null,
      }
    }
  }

  const practitionerName = practitioner
    ? [practitioner.firstName.trim(), practitioner.lastName.trim()].filter(Boolean).join(" ")
    : ""

  return {
    reportDate,
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    dateOfBirth: data.dateOfBirth,
    practitionerName,
    practitionerReportIntroduction: practitioner?.reportIntroduction ?? null,
    data,
    screening,
    interviews,
    selfReportDate: selfReport ? isoDate(new Date(selfReport.assessmentDate)) : null,
    numberOfChildren: selfReport?.answers.familyHome.numberOfChildren ?? null,
    referral,
  }
}
