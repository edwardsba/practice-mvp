/**
 * Load the living client file for Confirm-section presence (Round AR.2).
 * Reuses the same loaders as the Background interview page.
 */
import "server-only"

import { and, eq } from "drizzle-orm"

import { assessAge, displayedAge } from "@/lib/client-background/age"
import type { InterviewConfirmFile } from "@/lib/client-background/interview-confirm-presence"
import { loadClientBackground } from "@/lib/client-background/load"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import { professionalOptionLabel } from "@/lib/client-background/professionals"
import { emptyDemographics } from "@/lib/client-background/types"
import { formatClientDisplayName } from "@/lib/clients/display-name"
import { loadEmergencyContacts } from "@/lib/crisis-plans/load"
import { clients } from "@/db/schema"
import { todayDateString } from "@/lib/dates/practice-time"
import { db } from "@/lib/db"
import { loadClaimsPageForClient } from "@/lib/funding/load-claims-page"
import { loadMedicalContactsWithSupervises } from "@/lib/medical-contacts/load"

export async function loadInterviewConfirmFile(
  clientId: string,
  practiceId: string
): Promise<InterviewConfirmFile | null> {
  const [client] = await db
    .select({
      firstName: clients.firstName,
      preferredName: clients.preferredName,
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
      and(eq(clients.clientId, clientId), eq(clients.practiceId, practiceId), eq(clients.isActive, true))
    )
    .limit(1)
  if (!client) return null

  const [background, emergencyContacts, medical, claimsPage] = await Promise.all([
    loadClientBackground(clientId, practiceId),
    loadEmergencyContacts(clientId, practiceId),
    loadMedicalContactsWithSupervises(clientId, practiceId),
    loadClaimsPageForClient(clientId),
  ])

  const demographics = background?.demographics ?? emptyDemographics()
  const relationships = background?.relationships ?? []
  const blocks = background?.relationshipBlocks ?? []
  const claimsModel = claimsPage?.model
  const claimTypeCodes = claimsModel
    ? [...claimsModel.activeClaims, ...claimsModel.inactiveClaims].map((claim) => claim.claimTypeCode)
    : []

  const ageLabel = displayedAge(
    assessAge(
      parsePartialDate(client.dateOfBirth ?? ""),
      parsePartialDate(todayDateString()),
      "person"
    )
  )

  return {
    clientDisplayName: formatClientDisplayName(client.firstName, client.preferredName, client.lastName),
    preferredName: client.preferredName,
    dateOfBirth: client.dateOfBirth,
    ageLabel,
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
    demographics,
    relationships,
    blocks,
    emergencyContacts: emergencyContacts.map((row) => ({
      id: row.contactId,
      name: row.name,
      role: row.role,
      phone: row.phone,
      email: row.email,
    })),
    medicalContacts: medical.contacts.map((row) => ({
      id: row.medicalContactId,
      name: professionalOptionLabel(row.professional),
      organisationName: row.organisationName ?? null,
      phone: row.phone ?? null,
      isMain: row.isResolvedMain,
      professionName: row.professional.professionName,
    })),
    claimTypeCodes,
  }
}
