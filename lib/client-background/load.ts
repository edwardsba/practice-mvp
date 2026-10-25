import "server-only"

import { and, asc, desc, eq, sql } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResults,
  clientBackgroundInterviews,
  clientBackgrounds,
  clientEventRecords,
  clientPartnershipRecords,
  clientRelationshipRecords,
  clients,
  fundingApprovals,
  practitionerProfiles,
  professionalOrganisations,
  professionals,
  professions,
} from "@/db/schema"
import { sanitizeBackgroundAnswers } from "@/lib/background-questionnaire/answers"
import { BACKGROUND_ASSESSMENT_CODE, type BackgroundSelfReport } from "@/lib/background-questionnaire/types"
import { db } from "@/lib/db"
import { settleEventDates } from "@/lib/client-background/age"
import {
  answeredInterviewCount,
  sanitizeScreening,
  type BackgroundInterviewAnswerSource,
} from "@/lib/client-background/interview-history"
import { toClientRelationshipStatus, toEvent, toPartnership, toRelationship } from "@/lib/client-background/map"
import {
  demographicsFromStored,
  sanitizeMedication,
  sanitizeReasonForAttending,
  sanitizeRisk,
  sanitizeStressors,
} from "@/lib/client-background/sanitize"
import {
  sortProfessionals,
  type OrganisationOption,
  type ProfessionOption,
  type ProfessionalOption,
} from "@/lib/client-background/professionals"
import {
  emptyDemographics,
  emptyClientRelationshipStatus,
  emptyMedication,
  emptyReasonForAttending,
  emptyRisk,
  emptyStressors,
  type ClientBackgroundData,
  type MedicationRecord,
} from "@/lib/client-background/types"

async function clientInPractice(clientId: string, practiceId: string) {
  const [client] = await db
    .select({
      clientId: clients.clientId,
      dateOfBirth: clients.dateOfBirth,
      backgroundCapturedAt: clients.backgroundCapturedAt,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)
  return client ?? null
}

export async function loadClientBackground(
  clientId: string,
  practiceId: string
): Promise<ClientBackgroundData | null> {
  const client = await clientInPractice(clientId, practiceId)
  if (!client) return null

  const [background] = await db
    .select()
    .from(clientBackgrounds)
    .where(
      and(
        eq(clientBackgrounds.clientId, clientId),
        eq(clientBackgrounds.practiceId, practiceId)
      )
    )
    .limit(1)

  const relationshipRows = await db
    .select()
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.clientId, clientId),
        eq(clientRelationshipRecords.practiceId, practiceId)
      )
    )
    .orderBy(asc(clientRelationshipRecords.displayOrder))

  const partnershipRows = await db
    .select()
    .from(clientPartnershipRecords)
    .where(
      and(
        eq(clientPartnershipRecords.clientId, clientId),
        eq(clientPartnershipRecords.practiceId, practiceId)
      )
    )

  const eventRows = await db
    .select()
    .from(clientEventRecords)
    .where(
      and(
        eq(clientEventRecords.clientId, clientId),
        eq(clientEventRecords.practiceId, practiceId)
      )
    )
    .orderBy(asc(clientEventRecords.displayOrder))

  return {
    dateOfBirth: client.dateOfBirth,
    backgroundCapturedAt: client.backgroundCapturedAt
      ? client.backgroundCapturedAt.toISOString()
      : null,
    relationshipStatus: background
      ? toClientRelationshipStatus(background)
      : emptyClientRelationshipStatus(),
    demographics: background
      ? demographicsFromStored(background)
      : emptyDemographics(),
    medication: background ? sanitizeMedication(background.medicationJson) : emptyMedication(),
    stressors: background ? sanitizeStressors(background.stressorsJson) : emptyStressors(),
    reason: background ? sanitizeReasonForAttending(background.reasonForAttendingJson) : emptyReasonForAttending(),
    relationships: relationshipRows.map(toRelationship),
    partnerships: partnershipRows.map(toPartnership),
    events: eventRows.map((row) => settleEventDates(toEvent(row), client.dateOfBirth)),
    risk: background?.riskJson ? sanitizeRisk(background.riskJson) : emptyRisk(),
  }
}

export async function loadClientBackgroundSummary(
  clientId: string,
  practiceId: string
): Promise<{
  relationshipCount: number
  eventCount: number
  backgroundCapturedAt: Date | null
} | null> {
  const client = await clientInPractice(clientId, practiceId)
  if (!client) return null

  const [relationships] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.clientId, clientId),
        eq(clientRelationshipRecords.practiceId, practiceId)
      )
    )

  const [events] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clientEventRecords)
    .where(
      and(
        eq(clientEventRecords.clientId, clientId),
        eq(clientEventRecords.practiceId, practiceId)
      )
    )

  return {
    relationshipCount: relationships?.count ?? 0,
    eventCount: events?.count ?? 0,
    backgroundCapturedAt: client.backgroundCapturedAt,
  }
}

export type BackgroundInterviewCardData = {
  inProgress: { startedAt: string; answered: number } | null
  lastCompletedAt: string | null
  completed: { interviewId: string; completedAt: string; practitionerName: string }[]
  latest: BackgroundInterviewAnswerSource | null
}

function interviewDate(value: Date) {
  return value.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  })
}

function practitionerName(row: { preferredName: string | null; firstName: string; lastName: string }) {
  const given = row.preferredName?.trim() || row.firstName.trim()
  return [given, row.lastName.trim()].filter(Boolean).join(" ")
}

export async function loadBackgroundInterviewCard(
  clientId: string,
  practiceId: string
): Promise<BackgroundInterviewCardData | null> {
  const client = await clientInPractice(clientId, practiceId)
  if (!client) return null

  const rows = await db
    .select({
      interviewId: clientBackgroundInterviews.clientBackgroundInterviewId,
      status: clientBackgroundInterviews.status,
      startedAt: clientBackgroundInterviews.startedAt,
      completedAt: clientBackgroundInterviews.completedAt,
      screeningJson: clientBackgroundInterviews.screeningJson,
      preferredName: practitionerProfiles.preferredName,
      firstName: practitionerProfiles.firstName,
      lastName: practitionerProfiles.lastName,
    })
    .from(clientBackgroundInterviews)
    .innerJoin(
      practitionerProfiles,
      eq(practitionerProfiles.practitionerProfileId, clientBackgroundInterviews.practitionerProfileId)
    )
    .where(
      and(
        eq(clientBackgroundInterviews.clientId, clientId),
        eq(clientBackgroundInterviews.practiceId, practiceId)
      )
    )
    .orderBy(desc(clientBackgroundInterviews.startedAt))

  const eventRows = await db
    .select()
    .from(clientEventRecords)
    .where(and(eq(clientEventRecords.clientId, clientId), eq(clientEventRecords.practiceId, practiceId)))
  const events = eventRows.map((row) => toEvent(row))

  const [background] = await db
    .select({
      medicationJson: clientBackgrounds.medicationJson,
      stressorsJson: clientBackgrounds.stressorsJson,
      reasonForAttendingJson: clientBackgrounds.reasonForAttendingJson,
    })
    .from(clientBackgrounds)
    .where(and(eq(clientBackgrounds.clientId, clientId), eq(clientBackgrounds.practiceId, practiceId)))
    .limit(1)
  const medication = sanitizeMedication(background?.medicationJson)
  const stressors = sanitizeStressors(background?.stressorsJson)
  const reason = sanitizeReasonForAttending(background?.reasonForAttendingJson)

  const inProgress = rows.find((row) => row.status === "in_progress") ?? null
  const completed = rows
    .filter((row) => row.status === "completed" && row.completedAt)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
  const latestRow = rows.find((row) => row.status === "in_progress" || row.status === "completed") ?? null

  return {
    inProgress: inProgress
      ? {
          startedAt: interviewDate(inProgress.startedAt),
          answered: answeredInterviewCount(
            sanitizeScreening(inProgress.screeningJson),
            events,
            client.dateOfBirth,
            medication,
            stressors,
            reason
          ),
        }
      : null,
    latest: latestRow
      ? {
          status: latestRow.status === "in_progress" ? "in_progress" : "completed",
          dateLabel: interviewDate(
            latestRow.status === "completed" && latestRow.completedAt ? latestRow.completedAt : latestRow.startedAt
          ),
          screening: sanitizeScreening(latestRow.screeningJson),
        }
      : null,
    lastCompletedAt: completed[0]?.completedAt ? interviewDate(completed[0].completedAt) : null,
    completed: completed.flatMap((row) =>
      row.completedAt
        ? [
            {
              interviewId: row.interviewId,
              completedAt: interviewDate(row.completedAt),
              practitionerName: practitionerName(row),
            },
          ]
        : []
    ),
  }
}

export async function loadInProgressInterview(clientId: string, practiceId: string) {
  const client = await clientInPractice(clientId, practiceId)
  if (!client) return null
  const [row] = await db
    .select({
      interviewId: clientBackgroundInterviews.clientBackgroundInterviewId,
      screeningJson: clientBackgroundInterviews.screeningJson,
    })
    .from(clientBackgroundInterviews)
    .where(
      and(
        eq(clientBackgroundInterviews.clientId, clientId),
        eq(clientBackgroundInterviews.practiceId, practiceId),
        eq(clientBackgroundInterviews.status, "in_progress")
      )
    )
    .limit(1)
  if (!row) return null
  return { interviewId: row.interviewId, screening: sanitizeScreening(row.screeningJson) }
}

export async function loadMedicationRecord(
  clientId: string,
  practiceId: string
): Promise<MedicationRecord | null> {
  const client = await clientInPractice(clientId, practiceId)
  if (!client) return null
  const [background] = await db
    .select({ medicationJson: clientBackgrounds.medicationJson })
    .from(clientBackgrounds)
    .where(and(eq(clientBackgrounds.clientId, clientId), eq(clientBackgrounds.practiceId, practiceId)))
    .limit(1)
  return sanitizeMedication(background?.medicationJson)
}

/** The client's most recent BACKGROUND_SR result, or null when they have none. */
export async function loadLatestBackgroundSelfReport(
  clientId: string,
  practiceId: string
): Promise<BackgroundSelfReport | null> {
  const client = await clientInPractice(clientId, practiceId)
  if (!client) return null
  const [row] = await db
    .select({
      resultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      answers: assessmentResults.structuredScoreJson,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(assessmentInstances.assessmentInstanceId, assessmentResults.assessmentInstanceId)
    )
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentDefinitions.assessmentDefinitionId, assessmentInstances.assessmentDefinitionId)
    )
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentInstances.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, BACKGROUND_ASSESSMENT_CODE)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate), desc(assessmentResults.createdAt))
    .limit(1)
  if (!row) return null
  return {
    resultId: row.resultId,
    assessmentDate: row.assessmentDate.toISOString(),
    answers: sanitizeBackgroundAnswers(row.answers),
  }
}

export type ReasonSupport = {
  professionals: ProfessionalOption[]
  professions: ProfessionOption[]
  organisations: OrganisationOption[]
  suggestedProfessionalId: string | null
}

function toProfessionalOption(row: {
  professionalId: string
  title: string | null
  firstName: string
  lastName: string
  professionName: string | null
}): ProfessionalOption {
  return row
}

/** Active professionals in the practice, plus a saved referrer who is no longer active. */
export async function loadReasonSupport(
  clientId: string,
  practiceId: string,
  selectedProfessionalId: string | null
): Promise<ReasonSupport> {
  const listed = await db
    .select({
      professionalId: professionals.professionalId,
      title: professionals.title,
      firstName: professionals.firstName,
      lastName: professionals.lastName,
      professionName: professions.professionName,
    })
    .from(professionals)
    .leftJoin(professions, eq(professionals.professionId, professions.professionId))
    .where(and(eq(professionals.practiceId, practiceId), eq(professionals.isActive, true)))
    .orderBy(asc(professionals.lastName), asc(professionals.firstName))

  let options = listed.map(toProfessionalOption)
  if (selectedProfessionalId && !options.some((item) => item.professionalId === selectedProfessionalId)) {
    const [selected] = await db
      .select({
        professionalId: professionals.professionalId,
        title: professionals.title,
        firstName: professionals.firstName,
        lastName: professionals.lastName,
        professionName: professions.professionName,
      })
      .from(professionals)
      .leftJoin(professions, eq(professionals.professionId, professions.professionId))
      .where(
        and(eq(professionals.professionalId, selectedProfessionalId), eq(professionals.practiceId, practiceId))
      )
      .limit(1)
    if (selected) options = sortProfessionals([...options, selected])
  }

  const approvals = await db
    .select({
      referrerId: fundingApprovals.referrerId,
      startDate: fundingApprovals.startDate,
      createdAt: fundingApprovals.createdAt,
    })
    .from(fundingApprovals)
    .innerJoin(
      professionals,
      and(
        eq(professionals.professionalId, fundingApprovals.referrerId),
        eq(professionals.practiceId, practiceId),
        eq(professionals.isActive, true)
      )
    )
    .where(
      and(
        eq(fundingApprovals.clientId, clientId),
        eq(fundingApprovals.practiceId, practiceId),
        eq(fundingApprovals.isActive, true),
        eq(fundingApprovals.approvalStatus, "active")
      )
    )

  approvals.sort((a, b) => {
    const aDate = a.startDate?.trim() ?? ""
    const bDate = b.startDate?.trim() ?? ""
    if (aDate !== bDate) {
      if (!aDate) return 1
      if (!bDate) return -1
      return bDate.localeCompare(aDate)
    }
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
  const suggested = approvals[0]?.referrerId ?? null
  const suggestedProfessionalId =
    suggested && options.some((item) => item.professionalId === suggested) ? suggested : null

  const professionRows = await db
    .select({
      professionId: professions.professionId,
      professionName: professions.professionName,
    })
    .from(professions)
    .where(and(eq(professions.practiceId, practiceId), eq(professions.isActive, true)))
    .orderBy(asc(professions.professionName))

  const organisationRows = await db
    .select({
      organisationId: professionalOrganisations.organisationId,
      organisationName: professionalOrganisations.organisationName,
    })
    .from(professionalOrganisations)
    .where(
      and(eq(professionalOrganisations.practiceId, practiceId), eq(professionalOrganisations.isActive, true))
    )
    .orderBy(asc(professionalOrganisations.organisationName))

  return {
    professionals: options,
    professions: professionRows,
    organisations: organisationRows,
    suggestedProfessionalId,
  }
}
