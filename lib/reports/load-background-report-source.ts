import "server-only"

import { and, asc, eq } from "drizzle-orm"

import {
  appointments,
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
  clientBackgroundInterviews,
  clients,
  practitionerPracticeMemberships,
  practitionerProfiles,
  professionals,
  professions,
} from "@/db/schema"
import { BACKGROUND_ASSESSMENT_CODE } from "@/lib/background-questionnaire/types"
import { sanitizeScreening } from "@/lib/client-background/interview-history"
import { loadClientBackground, loadLatestBackgroundSelfReport } from "@/lib/client-background/load"
import { db } from "@/lib/db"
import type {
  BackgroundReportQuestionnaire,
  BackgroundReportSageModule,
  BackgroundReportSource,
} from "@/lib/reports/generate-background-report"

const SAGE_MODULES = [
  ["SAGE_SR_CORE", "Core"],
  ["SAGE_SR_BACKGROUND", "Background"],
  ["SAGE_SR_PERSONALITY", "Personality"],
] as const

const ABBREVIATIONS: Record<string, string> = {
  PHQ9: "PHQ-9",
  PHQ2: "PHQ-2",
  GAD7: "GAD-7",
  GAD2: "GAD-2",
  DASS21: "DASS-21",
  PCPTSD5: "PC-PTSD-5",
}

function isoDate(value: Date): string {
  return value.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" })
}

function abbreviationFor(code: string): string {
  return ABBREVIATIONS[code] ?? code
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
      title: practitionerProfiles.title,
      firstName: practitionerProfiles.firstName,
      lastName: practitionerProfiles.lastName,
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

  const interviews = await db
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

  const latestInterview = [...interviews]
    .reverse()
    .find((row) => row.status === "in_progress" || row.status === "completed")
  const interviewAt =
    latestInterview?.status === "completed" && latestInterview.completedAt
      ? latestInterview.completedAt
      : latestInterview?.startedAt

  const screening = latestInterview ? sanitizeScreening(latestInterview.screeningJson) : null

  const selfReport = await loadLatestBackgroundSelfReport(clientId, practiceId)

  const results = await db
    .select({
      code: assessmentDefinitions.assessmentCode,
      name: assessmentDefinitions.assessmentName,
      assessmentDate: assessmentResults.assessmentDate,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      and(
        eq(assessmentInstances.assessmentInstanceId, assessmentResults.assessmentInstanceId),
        eq(assessmentInstances.practiceId, practiceId)
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentDefinitions.assessmentDefinitionId, assessmentInstances.assessmentDefinitionId)
    )
    .where(and(eq(assessmentResults.clientId, clientId), eq(assessmentResults.practiceId, practiceId)))

  const sageModules: BackgroundReportSageModule[] = []
  for (const [code, name] of SAGE_MODULES) {
    const dates = results
      .filter((row) => row.code === code)
      .map((row) => isoDate(row.assessmentDate))
      .sort()
    if (dates.length > 0) sageModules.push({ name, date: dates[dates.length - 1] })
  }

  const grouped = new Map<string, BackgroundReportQuestionnaire>()
  for (const row of results) {
    if (row.code === BACKGROUND_ASSESSMENT_CODE || row.code.startsWith("SAGE_SR_")) continue
    const existing = grouped.get(row.code)
    const date = isoDate(row.assessmentDate)
    if (existing) existing.dates.push(date)
    else {
      grouped.set(row.code, {
        fullName: row.name,
        abbreviation: abbreviationFor(row.code),
        dates: [date],
      })
    }
  }

  const [firstAppointment] = await db
    .select({ appointmentDate: appointments.appointmentDate })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.practiceId, practiceId),
        eq(appointments.status, "completed")
      )
    )
    .orderBy(asc(appointments.appointmentDate))
    .limit(1)

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
    ? [practitioner.title?.trim(), practitioner.firstName.trim(), practitioner.lastName.trim()].filter(Boolean).join(" ")
    : ""

  return {
    reportDate,
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    dateOfBirth: data.dateOfBirth,
    practitionerName,
    profession: null,
    yearRegistered: null,
    data,
    screening,
    interviewDate: interviewAt ? isoDate(interviewAt) : null,
    selfReportDate: selfReport ? isoDate(new Date(selfReport.assessmentDate)) : null,
    numberOfChildren: selfReport?.answers.familyHome.numberOfChildren ?? null,
    sageModules,
    questionnaires: [...grouped.values()],
    firstAttendedAppointment: firstAppointment?.appointmentDate ?? null,
    referral,
  }
}
