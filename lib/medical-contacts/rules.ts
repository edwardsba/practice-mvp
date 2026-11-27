import { ongoingMedicationEvents } from "@/lib/client-background/medication"
import type { EventRecord } from "@/lib/client-background/types"
import {
  professionalOptionLabel,
  type ProfessionalOption,
} from "@/lib/client-background/professionals"

export type MedicalContactRecord = {
  medicalContactId: string
  clientId: string
  practiceId: string
  professionalId: string
  isMain: boolean
  notes: string | null
}

export type MedicalContactWithProfessional = MedicalContactRecord & {
  professional: ProfessionalOption
  /** First active organisation link, when loaded. */
  organisationName?: string | null
  phone?: string | null
}

/**
 * Main contact: sole contact wins even if is_main is false;
 * otherwise the one marked is_main; otherwise none.
 */
export function resolveMainMedicalContact<T extends { isMain: boolean }>(
  contacts: T[]
): T | null {
  if (contacts.length === 0) return null
  if (contacts.length === 1) return contacts[0]
  return contacts.find((contact) => contact.isMain) ?? null
}

/** Ongoing medications supervised by this professional. */
export function ongoingMedicationsForProfessional(
  events: EventRecord[],
  professionalId: string
): EventRecord[] {
  return ongoingMedicationEvents(events).filter(
    (event) => event.prescriberProfessionalId === professionalId
  )
}

/**
 * "Supervises" line for a medical contact row.
 * e.g. "Sertraline (ongoing)" or "No current medication".
 */
export function formatSupervisesLine(
  events: EventRecord[],
  professionalId: string
): string {
  const meds = ongoingMedicationsForProfessional(events, professionalId)
  if (meds.length === 0) return "No current medication"
  return meds
    .map((event) => {
      const name = event.title.trim() || "Medication"
      return `${name} (ongoing)`
    })
    .join("; ")
}

/**
 * True when History still has a medication (any, not only ongoing) pointing at this professional.
 */
export function medicalContactSupervisesHistoryMedication(
  events: EventRecord[],
  professionalId: string
): boolean {
  return events.some(
    (event) =>
      event.eventType === "medication" &&
      event.prescriberProfessionalId === professionalId
  )
}

export const MEDICAL_CONTACT_IN_USE_MESSAGE =
  "Supervises a medication in History. Change the medication first."

/** Display "Name · profession" for a medical contact row. */
export function formatMedicalContactLabel(
  professional: ProfessionalOption
): string {
  const name = [
    professional.title?.trim(),
    professional.firstName.trim(),
    professional.lastName.trim(),
  ]
    .filter(Boolean)
    .join(" ")
  const profession = professional.professionName?.trim()
  return profession ? `${name} · ${profession}` : name
}

function supervisedByLabel(professional: ProfessionalOption): string {
  const name = [
    professional.title?.trim(),
    professional.firstName.trim(),
    professional.lastName.trim(),
  ]
    .filter(Boolean)
    .join(" ")
  const profession = professional.professionName?.trim()
  return profession ? `${name} (${profession})` : name
}

/**
 * Live treatment-plan / PDF supervision line.
 * "Yes, by Dr Harry TestDoc (GP)" or "No".
 */
export function formatMedicationSupervisedAnswer(
  events: EventRecord[],
  professionals: ProfessionalOption[]
): { supervised: boolean; line: string; fullLine: string } {
  const ongoing = ongoingMedicationEvents(events).filter(
    (event) => event.prescriberProfessionalId
  )
  if (ongoing.length === 0) {
    return {
      supervised: false,
      line: "No",
      fullLine: "Medication supervised: No",
    }
  }

  const byId = new Map(
    professionals.map((row) => [row.professionalId, row] as const)
  )
  const names = new Set<string>()
  for (const event of ongoing) {
    const id = event.prescriberProfessionalId
    if (!id) continue
    const professional = byId.get(id)
    names.add(
      professional ? supervisedByLabel(professional) : "Unknown prescriber"
    )
  }

  const joined = [...names].join("; ")
  const line = `Yes, by ${joined}`
  return {
    supervised: true,
    line,
    fullLine: `Medication supervised: ${line}`,
  }
}

export function medicalContactOptionLabel(
  professional: ProfessionalOption
): string {
  return professionalOptionLabel(professional)
}
