import "server-only"

import { and, asc, desc, eq, sql } from "drizzle-orm"

import {
  clientBackgroundInterviews,
  clientBackgrounds,
  clientEventRecords,
  clientPartnershipRecords,
  clientRelationshipRecords,
  clients,
  practitionerProfiles,
} from "@/db/schema"
import { db } from "@/lib/db"
import { settleEventDates } from "@/lib/client-background/age"
import { sanitizeScreening, screeningAnsweredCount } from "@/lib/client-background/interview-history"
import { toClientRelationshipStatus, toEvent, toPartnership, toRelationship } from "@/lib/client-background/map"
import {
  demographicsFromStored,
  sanitizeRisk,
} from "@/lib/client-background/sanitize"
import {
  emptyDemographics,
  emptyClientRelationshipStatus,
  emptyRisk,
  type ClientBackgroundData,
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

  const inProgress = rows.find((row) => row.status === "in_progress") ?? null
  const completed = rows
    .filter((row) => row.status === "completed" && row.completedAt)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))

  return {
    inProgress: inProgress
      ? {
          startedAt: interviewDate(inProgress.startedAt),
          answered: screeningAnsweredCount(sanitizeScreening(inProgress.screeningJson), events, client.dateOfBirth),
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
