import { and, desc, eq } from "drizzle-orm"

import {
  clients,
  intakeEventRecords,
  intakeInterviews,
  intakeRelationshipRecords,
} from "@/db/schema"
import { db } from "@/lib/db"
import { payloadFromStoredJson, fromStoredEvent, fromStoredRelationship, toInterviewRow } from "@/lib/intake-interview/serialize"
import type { IntakeInterviewRow } from "@/lib/intake-interview/types"

export async function verifyClientInPractice(clientId: string, practiceId: string) {
  const [client] = await db
    .select({
      clientId: clients.clientId,
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
      email: clients.email,
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

export async function loadIntakeInterviewForPractice(
  interviewId: string,
  clientId: string,
  practiceId: string
): Promise<IntakeInterviewRow | null> {
  const [row] = await db
    .select()
    .from(intakeInterviews)
    .where(
      and(
        eq(intakeInterviews.intakeInterviewId, interviewId),
        eq(intakeInterviews.clientId, clientId),
        eq(intakeInterviews.practiceId, practiceId),
        eq(intakeInterviews.isActive, true)
      )
    )
    .limit(1)

  if (!row) return null

  const [relationshipRows, eventRows] = await Promise.all([
    db
      .select()
      .from(intakeRelationshipRecords)
      .where(eq(intakeRelationshipRecords.intakeInterviewId, interviewId))
      .orderBy(intakeRelationshipRecords.displayOrder),
    db
      .select()
      .from(intakeEventRecords)
      .where(eq(intakeEventRecords.intakeInterviewId, interviewId))
      .orderBy(intakeEventRecords.displayOrder),
  ])

  const payload = payloadFromStoredJson({
    interviewDate: row.interviewDate,
    identityJson: row.identityJson,
    familyOfOriginRosterJson: row.familyOfOriginRosterJson,
    partnersChildrenRosterJson: row.partnersChildrenRosterJson,
    familyHistoryJson: row.familyHistoryJson,
    livingSituationJson: row.livingSituationJson,
    educationJson: row.educationJson,
    occupationJson: row.occupationJson,
    financialSituationJson: row.financialSituationJson,
    socialSupportJson: row.socialSupportJson,
    relationships: relationshipRows.map(fromStoredRelationship),
    events: eventRows.map(fromStoredEvent),
  })

  return toInterviewRow({
    intakeInterviewId: row.intakeInterviewId,
    clientId: row.clientId,
    practiceId: row.practiceId,
    practitionerProfileId: row.practitionerProfileId,
    interviewDate: row.interviewDate,
    status: row.status,
    versionNumber: row.versionNumber,
    isCurrentVersion: row.isCurrentVersion,
    previousVersionId: row.previousVersionId,
    isActive: row.isActive,
    familyOfOriginSummary: row.familyOfOriginSummary,
    partnersChildrenSummary: row.partnersChildrenSummary,
    finalisedAt: row.finalisedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    payload,
  })
}

export async function loadCurrentIntakeInterview(
  clientId: string,
  practiceId: string
): Promise<IntakeInterviewRow | null> {
  const [row] = await db
    .select({ intakeInterviewId: intakeInterviews.intakeInterviewId })
    .from(intakeInterviews)
    .where(
      and(
        eq(intakeInterviews.clientId, clientId),
        eq(intakeInterviews.practiceId, practiceId),
        eq(intakeInterviews.isCurrentVersion, true),
        eq(intakeInterviews.isActive, true)
      )
    )
    .limit(1)

  if (!row) return null
  return loadIntakeInterviewForPractice(
    row.intakeInterviewId,
    clientId,
    practiceId
  )
}

export async function loadIntakeInterviewVersions(
  clientId: string,
  practiceId: string
) {
  return db
    .select({
      intakeInterviewId: intakeInterviews.intakeInterviewId,
      versionNumber: intakeInterviews.versionNumber,
      status: intakeInterviews.status,
      isCurrentVersion: intakeInterviews.isCurrentVersion,
      interviewDate: intakeInterviews.interviewDate,
      createdAt: intakeInterviews.createdAt,
      finalisedAt: intakeInterviews.finalisedAt,
    })
    .from(intakeInterviews)
    .where(
      and(
        eq(intakeInterviews.clientId, clientId),
        eq(intakeInterviews.practiceId, practiceId),
        eq(intakeInterviews.isActive, true)
      )
    )
    .orderBy(desc(intakeInterviews.versionNumber))
}

export async function loadCurrentIntakeInterviewSummary(
  clientId: string,
  practiceId: string
): Promise<{
  intakeInterviewId: string
  versionNumber: number
  status: string
  interviewDate: string | null
} | null> {
  const [row] = await db
    .select({
      intakeInterviewId: intakeInterviews.intakeInterviewId,
      versionNumber: intakeInterviews.versionNumber,
      status: intakeInterviews.status,
      interviewDate: intakeInterviews.interviewDate,
    })
    .from(intakeInterviews)
    .where(
      and(
        eq(intakeInterviews.clientId, clientId),
        eq(intakeInterviews.practiceId, practiceId),
        eq(intakeInterviews.isCurrentVersion, true),
        eq(intakeInterviews.isActive, true)
      )
    )
    .limit(1)

  return row ?? null
}
