import "server-only"

import { and, asc, eq, inArray } from "drizzle-orm"

import {
  clientEventRecords,
  clientMedicalContacts,
  professionals,
  professions,
} from "@/db/schema"
import { toEvent } from "@/lib/client-background/map"
import { ongoingMedicationEvents } from "@/lib/client-background/medication"
import {
  sortProfessionals,
  type ProfessionalOption,
} from "@/lib/client-background/professionals"
import { db } from "@/lib/db"
import {
  formatSupervisesLine,
  resolveMainMedicalContact,
  type MedicalContactWithProfessional,
} from "@/lib/medical-contacts/rules"

export async function loadMedicalContactsForClient(
  clientId: string,
  practiceId: string
): Promise<MedicalContactWithProfessional[]> {
  const rows = await db
    .select({
      medicalContactId: clientMedicalContacts.medicalContactId,
      clientId: clientMedicalContacts.clientId,
      practiceId: clientMedicalContacts.practiceId,
      professionalId: clientMedicalContacts.professionalId,
      isMain: clientMedicalContacts.isMain,
      notes: clientMedicalContacts.notes,
      title: professionals.title,
      firstName: professionals.firstName,
      lastName: professionals.lastName,
      professionName: professions.professionName,
    })
    .from(clientMedicalContacts)
    .innerJoin(
      professionals,
      eq(professionals.professionalId, clientMedicalContacts.professionalId)
    )
    .leftJoin(professions, eq(professionals.professionId, professions.professionId))
    .where(
      and(
        eq(clientMedicalContacts.clientId, clientId),
        eq(clientMedicalContacts.practiceId, practiceId)
      )
    )
    .orderBy(asc(professionals.lastName), asc(professionals.firstName))

  const contacts: MedicalContactWithProfessional[] = rows.map((row) => ({
    medicalContactId: row.medicalContactId,
    clientId: row.clientId,
    practiceId: row.practiceId,
    professionalId: row.professionalId,
    isMain: row.isMain,
    notes: row.notes,
    professional: {
      professionalId: row.professionalId,
      title: row.title,
      firstName: row.firstName,
      lastName: row.lastName,
      professionName: row.professionName,
    },
  }))

  const sortedPros = sortProfessionals(contacts.map((c) => c.professional))
  const order = new Map(sortedPros.map((p, i) => [p.professionalId, i]))
  return [...contacts].sort(
    (a, b) =>
      (order.get(a.professionalId) ?? 0) - (order.get(b.professionalId) ?? 0)
  )
}

export async function loadMedicationEventsForClient(
  clientId: string,
  practiceId: string
) {
  const rows = await db
    .select()
    .from(clientEventRecords)
    .where(
      and(
        eq(clientEventRecords.clientId, clientId),
        eq(clientEventRecords.practiceId, practiceId),
        eq(clientEventRecords.eventType, "medication")
      )
    )
  return rows.map((row) => toEvent(row))
}

export async function loadMedicalContactsWithSupervises(
  clientId: string,
  practiceId: string
) {
  const [contacts, events] = await Promise.all([
    loadMedicalContactsForClient(clientId, practiceId),
    loadMedicationEventsForClient(clientId, practiceId),
  ])
  const main = resolveMainMedicalContact(contacts)
  return {
    contacts: contacts.map((contact) => ({
      ...contact,
      supervisesLine: formatSupervisesLine(events, contact.professionalId),
      isResolvedMain: main?.medicalContactId === contact.medicalContactId,
    })),
    events,
    main,
  }
}

/** Professionals who prescribe any ongoing medication for this client. */
export async function loadProfessionalsForOngoingMedicationPrescribers(
  clientId: string,
  practiceId: string
): Promise<ProfessionalOption[]> {
  const events = await loadMedicationEventsForClient(clientId, practiceId)
  const ids = [
    ...new Set(
      ongoingMedicationEvents(events)
        .map((event) => event.prescriberProfessionalId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  if (ids.length === 0) return []

  const rows = await db
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
      and(
        eq(professionals.practiceId, practiceId),
        inArray(professionals.professionalId, ids)
      )
    )

  return sortProfessionals(rows)
}
