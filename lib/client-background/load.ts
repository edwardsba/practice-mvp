import "server-only"

import { and, asc, eq, sql } from "drizzle-orm"

import {
  clientBackgrounds,
  clientEventRecords,
  clientPartnershipRecords,
  clientRelationshipRecords,
  clients,
} from "@/db/schema"
import { db } from "@/lib/db"
import { settleEventDates } from "@/lib/client-background/age"
import { toEvent, toPartnership, toRelationship } from "@/lib/client-background/map"
import {
  demographicsFromStored,
  sanitizeRisk,
} from "@/lib/client-background/sanitize"
import {
  emptyDemographics,
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
