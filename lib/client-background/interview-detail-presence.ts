/**
 * Whether each details (cna) interview item has living data on file.
 * Used when Confirm section sets confirmed vs not_applicable.
 * Pure — no database.
 */

import {
  S4_EC_PREFIX,
  S4_MC_PREFIX,
  detailsItemsInSection,
  INTERVIEW_SECTIONS,
  type InterviewItemDef,
  type InterviewSectionDef,
} from "@/lib/client-background/interview-answers"
import type { Demographics, RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"
import type { CommunicationPreferencesInput } from "@/lib/clients/communication-summary"
import {
  emergencyContactFactLines,
  medicalContactFactLines,
  section1FactLines,
} from "@/lib/client-background/interview-section-1-4-facts"
import {
  formatBiologicalParentsFacts,
  formatSection3FactLines,
  formatLivingSecurityLine,
  formatLivingTypeLine,
  formatLivingWhoFactLines,
} from "@/lib/client-background/interview-facts"

function lineHasRecorded(lines: string[] | null | undefined): boolean {
  if (!lines || lines.length === 0) return false
  return lines.some((line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (trimmed === "Not recorded") return false
    if (trimmed.endsWith(": Not recorded")) return false
    return true
  })
}

export type DetailPresenceInput = {
  clientDisplayName: string
  preferredName: string | null | undefined
  dateOfBirth: string | null | undefined
  ageLabel: string
  phone: string | null | undefined
  email: string | null | undefined
  address: string | null | undefined
  comms: CommunicationPreferencesInput
  demographics: Demographics
  relationships: RelationshipRecord[]
  blocks: RelationshipBlock[]
  emergencyContacts: Array<{
    id: string
    name: string
    role: string | null
    phone: string | null
    email: string | null
  }>
  medicalContacts: Array<{
    id: string
    name: string
    organisationName: string | null
    phone: string | null
    isMain: boolean
  }>
}

/** Map of details item key → has living value (for Confirm section). */
export function detailPresenceForInterview(input: DetailPresenceInput): Record<string, boolean> {
  const s1 = section1FactLines({
    preferredName: input.preferredName,
    dateOfBirth: input.dateOfBirth,
    ageLabel: input.ageLabel,
    phone: input.phone,
    email: input.email,
    address: input.address,
    comms: input.comms,
    clientDisplayName: input.clientDisplayName,
  })
  const s3 = formatSection3FactLines(input.demographics)
  const out: Record<string, boolean> = {}

  for (const [key, lines] of Object.entries(s1)) {
    out[key] = lineHasRecorded(lines)
  }
  for (const [key, lines] of Object.entries(s3)) {
    // s3_disability / s3_financial are questions (yna), not details.
    if (key === "s3_disability" || key === "s3_financial") continue
    out[key] = lineHasRecorded(lines)
  }

  out.s7_who =
    formatLivingWhoFactLines(input.demographics.livingSituation, input.relationships).length > 0
  out.s7_housing_type =
    formatLivingTypeLine(input.demographics.livingSituation).trim() !== "Not recorded"
  out.s7_housing_security =
    formatLivingSecurityLine(input.demographics.livingSituation).trim() !== "Not recorded"

  out.s6_biological_parents =
    formatBiologicalParentsFacts(input.blocks, input.relationships).length > 0

  for (const contact of input.emergencyContacts) {
    out[`${S4_EC_PREFIX}${contact.id}`] = lineHasRecorded(
      emergencyContactFactLines({
        name: contact.name,
        role: contact.role,
        phone: contact.phone,
        email: contact.email,
      })
    )
  }
  for (const contact of input.medicalContacts) {
    out[`${S4_MC_PREFIX}${contact.id}`] = lineHasRecorded(
      medicalContactFactLines({
        name: contact.name,
        organisationName: contact.organisationName,
        phone: contact.phone,
        isMain: contact.isMain,
      })
    )
  }

  return out
}

export function detailPresenceForSection(
  section: InterviewSectionDef,
  presence: Readonly<Record<string, boolean>>,
  extraItems: readonly InterviewItemDef[] = []
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const item of detailsItemsInSection(section, extraItems)) {
    out[item.key] = presence[item.key] === true
  }
  return out
}

export function sectionByNumber(sectionNumber: number): InterviewSectionDef | undefined {
  return INTERVIEW_SECTIONS.find((section) => section.number === sectionNumber)
}
