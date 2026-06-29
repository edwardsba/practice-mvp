import { and, asc, desc, eq } from "drizzle-orm"

import { clientEmergencyContacts, clients, crisisPlans } from "@/db/schema"
import { rowToCrisisPlan, rowToEmergencyContact } from "@/lib/crisis-plans/serialize"
import type { CrisisPlanRow, EmergencyContactRow } from "@/lib/crisis-plans/types"
import { db } from "@/lib/db"

export async function verifyClientInPractice(
  clientId: string,
  practiceId: string
) {
  const [client] = await db
    .select({
      clientId: clients.clientId,
      firstName: clients.firstName,
      lastName: clients.lastName,
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

export async function loadEmergencyContacts(
  clientId: string,
  practiceId: string
): Promise<EmergencyContactRow[]> {
  const rows = await db
    .select()
    .from(clientEmergencyContacts)
    .where(
      and(
        eq(clientEmergencyContacts.clientId, clientId),
        eq(clientEmergencyContacts.practiceId, practiceId)
      )
    )
    .orderBy(asc(clientEmergencyContacts.displayOrder))

  return rows.map(rowToEmergencyContact)
}

export async function loadCrisisPlanForPractice(
  crisisPlanId: string,
  clientId: string,
  practiceId: string
): Promise<CrisisPlanRow | null> {
  const [row] = await db
    .select()
    .from(crisisPlans)
    .where(
      and(
        eq(crisisPlans.crisisPlanId, crisisPlanId),
        eq(crisisPlans.clientId, clientId),
        eq(crisisPlans.practiceId, practiceId)
      )
    )
    .limit(1)

  if (!row) return null
  return rowToCrisisPlan(row)
}

export async function loadCrisisPlanVersions(
  clientId: string,
  practiceId: string
) {
  return db
    .select({
      crisisPlanId: crisisPlans.crisisPlanId,
      versionNumber: crisisPlans.versionNumber,
      isActive: crisisPlans.isActive,
      dateOfPlan: crisisPlans.dateOfPlan,
      createdAt: crisisPlans.createdAt,
    })
    .from(crisisPlans)
    .where(
      and(
        eq(crisisPlans.clientId, clientId),
        eq(crisisPlans.practiceId, practiceId)
      )
    )
    .orderBy(desc(crisisPlans.versionNumber))
}

export async function loadActiveCrisisPlanSummary(
  clientId: string,
  practiceId: string
) {
  const [row] = await db
    .select({
      crisisPlanId: crisisPlans.crisisPlanId,
      versionNumber: crisisPlans.versionNumber,
      dateOfPlan: crisisPlans.dateOfPlan,
    })
    .from(crisisPlans)
    .where(
      and(
        eq(crisisPlans.clientId, clientId),
        eq(crisisPlans.practiceId, practiceId),
        eq(crisisPlans.isActive, true)
      )
    )
    .limit(1)

  return row ?? null
}

export async function loadEmergencyContactById(
  contactId: string,
  clientId: string,
  practiceId: string
): Promise<EmergencyContactRow | null> {
  const [row] = await db
    .select()
    .from(clientEmergencyContacts)
    .where(
      and(
        eq(clientEmergencyContacts.contactId, contactId),
        eq(clientEmergencyContacts.clientId, clientId),
        eq(clientEmergencyContacts.practiceId, practiceId)
      )
    )
    .limit(1)

  if (!row) return null
  return rowToEmergencyContact(row)
}
