/**
 * Build Confirm-section presence and section 4 per-record extras from the living
 * client file (Round AR.2). Pure — no database. Mutations load the file, then call these.
 */

import {
  INTERVIEW_SECTIONS,
  section4ExtraItems,
  type InterviewAnswersJson,
  type InterviewItemDef,
} from "@/lib/client-background/interview-answers"
import {
  detailPresenceForInterview,
  detailPresenceForSection,
  type DetailPresenceInput,
} from "@/lib/client-background/interview-detail-presence"
import { isGpProfession, pickMedicareClaim } from "@/lib/client-background/interview-section-1-4-facts"
import type { Demographics, RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"
import type { CommunicationPreferencesInput } from "@/lib/clients/communication-summary"
import { isInsurerClaim, isNdisClaim } from "@/lib/funding/format"

/** Snapshot of what's on file for Confirm presence (demographics may be post–Use client's). */
export type InterviewConfirmFile = {
  clientDisplayName: string
  preferredName: string | null | undefined
  dateOfBirth: string | null | undefined
  ageLabel: string
  phone: string | null | undefined
  email: string | null | undefined
  address: string | null | undefined
  comms: CommunicationPreferencesInput
  demographics: Demographics
  relationships: readonly RelationshipRecord[]
  blocks: readonly RelationshipBlock[]
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
    professionName: string | null
  }>
  /** Claim type codes only — presence cares whether Medicare / NDIS / insurer exist. */
  claimTypeCodes: readonly (string | null | undefined)[]
}

export function detailPresenceInputFromConfirmFile(file: InterviewConfirmFile): DetailPresenceInput {
  const gpCount = file.medicalContacts.filter((c) => isGpProfession(c.professionName)).length
  const otherProfessionalCount = file.medicalContacts.length - gpCount
  const claimInputs = file.claimTypeCodes.map((claimTypeCode) => ({
    claimId: "",
    claimTypeName: "",
    claimTypeCode: claimTypeCode ?? null,
    medicareCardNumber: null,
    medicareIrn: null,
    medicareExpiry: null,
    insuranceOrganisationName: null,
    insuranceReferenceNumber: null,
    startDate: null,
    endDate: null,
    approvals: [],
  }))
  return {
    clientDisplayName: file.clientDisplayName,
    preferredName: file.preferredName,
    dateOfBirth: file.dateOfBirth,
    ageLabel: file.ageLabel,
    phone: file.phone,
    email: file.email,
    address: file.address,
    comms: file.comms,
    demographics: file.demographics,
    relationships: [...file.relationships],
    blocks: [...file.blocks],
    emergencyContacts: file.emergencyContacts,
    medicalContacts: file.medicalContacts.map(({ id, name, organisationName, phone, isMain }) => ({
      id,
      name,
      organisationName,
      phone,
      isMain,
    })),
    medicareClaimExists: pickMedicareClaim(claimInputs) != null,
    ndisClaimCount: file.claimTypeCodes.filter((code) => isNdisClaim(code)).length,
    insurerClaimCount: file.claimTypeCodes.filter((code) => isInsurerClaim(code)).length,
    gpCount,
    otherProfessionalCount,
  }
}

export function presenceFromConfirmFile(file: InterviewConfirmFile): Record<string, boolean> {
  return detailPresenceForInterview(detailPresenceInputFromConfirmFile(file))
}

/** Per-record section 4 extras from stored emergency / medical contacts. */
export function section4ExtrasFromConfirmFile(
  file: InterviewConfirmFile,
  answers: InterviewAnswersJson
): InterviewItemDef[] {
  const gpContacts = file.medicalContacts
    .filter((c) => isGpProfession(c.professionName))
    .map((c) => ({ id: c.id, label: c.name.trim() || "Unnamed" }))
  const otherMedicalContacts = file.medicalContacts
    .filter((c) => !isGpProfession(c.professionName))
    .map((c) => ({ id: c.id, label: c.name.trim() || "Unnamed" }))
  return section4ExtraItems({
    answers,
    emergencyContacts: file.emergencyContacts.map((c) => ({
      id: c.id,
      label: c.name.trim() || "Unnamed",
    })),
    gpContacts,
    otherMedicalContacts,
  })
}

/** Presence map for one section, including per-record extras when section 4. */
export function confirmDetailHasValue(
  sectionNumber: number,
  file: InterviewConfirmFile,
  answers: InterviewAnswersJson
): { detailHasValue: Record<string, boolean>; extraItems: InterviewItemDef[] } {
  const section = INTERVIEW_SECTIONS.find((item) => item.number === sectionNumber)
  if (!section) return { detailHasValue: {}, extraItems: [] }
  const extraItems = sectionNumber === 4 ? section4ExtrasFromConfirmFile(file, answers) : []
  const presence = presenceFromConfirmFile(file)
  return {
    detailHasValue: detailPresenceForSection(section, presence, extraItems),
    extraItems,
  }
}
